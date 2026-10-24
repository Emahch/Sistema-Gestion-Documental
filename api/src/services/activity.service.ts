import type { Types } from 'mongoose';
import { mongoose } from '../config/db';
import { ActivityLogModel } from '../models/activity-log.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { UserModel } from '../models/user.model';
import type { ActivityLog } from '../types/activity-log';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/http-error';
import { PermissionService } from './permission.service';

function toObjectId(id: string, field: string): Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`${field} inválido`);
  }
  return new mongoose.Types.ObjectId(id);
}

export interface ActivityListQuery {
  page?: unknown;
  limit?: unknown;
  from?: unknown;
  to?: unknown;
}

function toPage(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, 100);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ActivityRow = ActivityLog & { _id: Types.ObjectId };

function activityQueryOptions(query: ActivityListQuery): {
  page: number;
  limit: number;
  timestamp?: Record<string, Date>;
} {
  const page = toPage(query.page, 1);
  const limit = toPage(query.limit, 50);
  const from = toDate(query.from);
  const to = toDate(query.to);
  if (!from && !to) {
    return { page, limit };
  }
  const timestamp: Record<string, Date> = {};
  if (from) timestamp.$gte = from;
  if (to) timestamp.$lte = to;
  return { page, limit, timestamp };
}

async function findActivityPage(
  filter: Record<string, unknown>,
  options: ReturnType<typeof activityQueryOptions>
): Promise<{ data: ActivityRow[]; total: number }> {
  if (options.timestamp) {
    filter.timestamp = options.timestamp;
  }
  const [data, total] = await Promise.all([
    ActivityLogModel.find(filter)
      .sort({ timestamp: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    ActivityLogModel.countDocuments(filter),
  ]);
  return { data: data as ActivityRow[], total };
}

function activityUserId(item: Pick<ActivityLog, 'userId'>): string {
  const userId = item.userId as unknown;
  if (userId && typeof userId === 'object' && '_id' in (userId as Record<string, unknown>)) {
    return String((userId as { _id: Types.ObjectId })._id);
  }
  return String(userId);
}

async function activityEmailMap(data: ActivityRow[]): Promise<Map<string, string>> {
  const userIds = Array.from(
    new Set(data.filter((item) => !item.userEmail).map((item) => activityUserId(item)).filter(Boolean))
  );
  if (userIds.length === 0) {
    return new Map();
  }
  const users = await UserModel.find(
    { _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { email: 1 }
  ).lean();
  return new Map(users.map((user) => [String(user._id), user.email]));
}

export class ActivityService {
  private readonly permissions = new PermissionService();

  async resourceHistory(
    userId: string,
    resourceType: unknown,
    resourceId: unknown,
    query: ActivityListQuery,
    isAdmin: boolean
  ) {
    if (resourceType !== 'file' && resourceType !== 'folder') {
      throw new BadRequestError('resourceType debe ser file o folder');
    }
    if (typeof resourceId !== 'string' || !resourceId) {
      throw new BadRequestError('resourceId es obligatorio');
    }
    const rid = toObjectId(resourceId, 'resourceId');
    const options = activityQueryOptions(query);

    if (!isAdmin) {
      const resource = await this.permissions.findResource(resourceType, resourceId);
      let isOwner = false;
      if (resource) {
        isOwner = resource.doc.ownerId.toString() === userId;
      }
      if (!isOwner) {
        const anyLog = await ActivityLogModel.findOne({ resourceType, resourceId: rid }, { userId: 1, resourceSnapshot: 1 }).lean();
        if (anyLog) {
          const logUserObj = anyLog.userId as unknown;
          const logUser =
            logUserObj && typeof logUserObj === 'object' && '_id' in (logUserObj as Record<string, unknown>)
              ? String((logUserObj as { _id: Types.ObjectId })._id)
              : String(logUserObj);
          if (logUser === userId) {
            isOwner = true;
          } else {
            const snap = anyLog.resourceSnapshot as Record<string, unknown> | undefined;
            if (snap?.['ownerId'] && String(snap['ownerId']) === userId) {
              isOwner = true;
            }
          }
        }
      }
      if (!isOwner) {
        throw new ForbiddenError('Sin acceso al historial');
      }
    }

    const filter: Record<string, unknown> = { resourceType, resourceId: rid };
    const { data, total } = await findActivityPage(filter, options);
    const userMap = await activityEmailMap(data);

    const items = data.map((item) => {
      const uid = activityUserId(item);
      const email = item.userEmail || userMap.get(uid) || null;
      return {
        id: item._id.toString(),
        userId: uid,
        userEmail: email,
        action: item.action,
        status: item.status,
        resourceType: item.resourceType,
        resourceId: item.resourceId.toString(),
        resourceSnapshot: item.resourceSnapshot ?? {},
        details: item.details ?? {},
        timestamp: item.timestamp,
      };
    });

    return { data: items, total, page: options.page, limit: options.limit };
  }

  async affected(userId: string, query: ActivityListQuery) {
    const uid = new mongoose.Types.ObjectId(userId);
    const options = activityQueryOptions(query);

    const filter: Record<string, unknown> = {
      status: 'success',
      $or: [
        { affectedUserIds: uid },
        { userId: uid },
      ],
    };
    const { data, total } = await findActivityPage(filter, options);
    const userMap = await activityEmailMap(data);

    const items = data.map((item) => {
      const uid = activityUserId(item);
      const email = item.userEmail || userMap.get(uid) || null;
      return {
        id: item._id.toString(),
        actorId: uid,
        actorEmail: email,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId.toString(),
        resourceSnapshot: item.resourceSnapshot ?? {},
        timestamp: item.timestamp,
      };
    });

    return { data: items, total, page: options.page, limit: options.limit };
  }
}

export async function computeAffectedUserIds(input: {
  actorId: string;
  resourceType: 'file' | 'folder';
  resourceId: string | Types.ObjectId;
  ownerId?: string | Types.ObjectId | null;
}): Promise<Types.ObjectId[]> {
  const set = new Set<string>();
  const actor = typeof input.actorId === 'string' ? input.actorId : String(input.actorId);
  if (actor) set.add(actor);
  if (input.ownerId) {
    const owner = typeof input.ownerId === 'string' ? input.ownerId : String(input.ownerId);
    if (owner && owner !== actor) set.add(owner);
  }
  try {
    const rid = typeof input.resourceId === 'string' ? new mongoose.Types.ObjectId(input.resourceId) : (input.resourceId as Types.ObjectId);
    const shares = await ShareModel.find({ resourceId: rid }, { sharedWithId: 1 }).lean();
    for (const share of shares) {
      const sid = (share.sharedWithId as Types.ObjectId | undefined)?.toString();
      if (sid && sid !== actor) set.add(sid);
    }
  } catch {
    // ignore
  }
  return Array.from(set).map((id) => new mongoose.Types.ObjectId(id));
}

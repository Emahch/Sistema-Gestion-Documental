import type { Types } from 'mongoose';
import { mongoose } from '../config/db';
import { ActivityLogModel } from '../models/activity-log.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { UserModel } from '../models/user.model';
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
    const page = toPage(query.page, 1);
    const limit = toPage(query.limit, 50);
    const from = toDate(query.from);
    const to = toDate(query.to);

    if (!isAdmin) {
      const resource = await this.permissions.findResource(resourceType, resourceId);
      if (!resource) {
        throw new NotFoundError('Recurso no encontrado');
      }
      const isOwner = resource.doc.ownerId.toString() === userId;
      if (!isOwner) {
        throw new ForbiddenError('Sin acceso al historial');
      }
    }

    const filter: Record<string, unknown> = { resourceType, resourceId: rid };
    if (from || to) {
      const ts: Record<string, unknown> = {};
      if (from) ts.$gte = from;
      if (to) ts.$lte = to;
      filter.timestamp = ts;
    }

    const [data, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'email')
        .lean(),
      ActivityLogModel.countDocuments(filter),
    ]);

    const items = await Promise.all(
      data.map(async (item) => {
        let user = item.userId as unknown as { _id?: Types.ObjectId; email?: string } | null;
        if (!user || !user.email) {
          const uid = typeof item.userId === 'object' && item.userId && '_id' in item.userId ? (item.userId as { _id: Types.ObjectId })._id : item.userId;
          const u = await UserModel.findById(uid, { email: 1 }).lean();
          user = u ? ({ _id: u._id, email: u.email } as { _id?: Types.ObjectId; email?: string }) : user;
        }
        return {
          id: item._id.toString(),
          userId: user?._id ? user._id.toString() : String(item.userId),
          userEmail: user?.email ?? null,
          action: item.action,
          status: item.status,
          resourceType: item.resourceType,
          resourceId: item.resourceId.toString(),
          resourceSnapshot: item.resourceSnapshot ?? {},
          details: item.details ?? {},
          timestamp: item.timestamp,
        };
      })
    );

    return { data: items, total, page, limit };
  }

  async affected(userId: string, query: ActivityListQuery) {
    const uid = new mongoose.Types.ObjectId(userId);
    const page = toPage(query.page, 1);
    const limit = toPage(query.limit, 50);
    const from = toDate(query.from);
    const to = toDate(query.to);

    const filter: Record<string, unknown> = {
      affectedUserIds: uid,
      status: 'success',
      userId: { $ne: uid },
    };
    if (from || to) {
      const ts: Record<string, unknown> = {};
      if (from) ts.$gte = from;
      if (to) ts.$lte = to;
      filter.timestamp = ts;
    }

    const [data, total] = await Promise.all([
      ActivityLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'email')
        .lean(),
      ActivityLogModel.countDocuments(filter),
    ]);

    const items = await Promise.all(
      data.map(async (item) => {
        let user = item.userId as unknown as { _id?: Types.ObjectId; email?: string } | null;
        if (!user || !user.email) {
          const uid = typeof item.userId === 'object' && item.userId && '_id' in item.userId ? (item.userId as { _id: Types.ObjectId })._id : item.userId;
          const u = await UserModel.findById(uid, { email: 1 }).lean();
          user = u ? ({ _id: u._id, email: u.email } as { _id?: Types.ObjectId; email?: string }) : user;
        }
        return {
          id: item._id.toString(),
          actorId: user?._id ? user._id.toString() : String(item.userId),
          actorEmail: user?.email ?? null,
          action: item.action,
          resourceType: item.resourceType,
          resourceId: item.resourceId.toString(),
          resourceSnapshot: item.resourceSnapshot ?? {},
          timestamp: item.timestamp,
        };
      })
    );

    return { data: items, total, page, limit };
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

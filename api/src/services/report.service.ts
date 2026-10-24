import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import { mongoose as dbConn } from '../config/db';
import { ActivityLogModel } from '../models/activity-log.model';
import { FileModel } from '../models/file.model';
import { FolderModel } from '../models/folder.model';
import { ShareModel } from '../models/share.model';
import { UserModel } from '../models/user.model';
import { BadRequestError, NotFoundError } from '../errors/http-error';

const TIMEZONE = 'America/Guatemala';

function toObjectId(value: unknown, field: string): Types.ObjectId {
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new BadRequestError(`${field} inválido`);
  }
  return new mongoose.Types.ObjectId(value);
}

function toPage(value: unknown, fallback = 1): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

function toLimit(value: unknown, fallback = 10, max = 100): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, max);
}

function toDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${field} es obligatorio`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${field} inválido`);
  }
  return date;
}

function toOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return toDate(value, field);
}

function toRange(fromValue: unknown, toValue: unknown): { from: Date; to: Date } {
  const from = toDate(fromValue, 'from');
  const to = toDate(toValue, 'to');
  if (from.getTime() > to.getTime()) {
    throw new BadRequestError('from no puede ser posterior a to');
  }
  return { from, to };
}

function optionalRange(fromValue: unknown, toValue: unknown): Record<string, Date> | null {
  const from = toOptionalDate(fromValue, 'from');
  const to = toOptionalDate(toValue, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestError('from no puede ser posterior a to');
  }
  if (!from && !to) {
    return null;
  }
  const range: Record<string, Date> = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return range;
}

interface ResourceName {
  name: string;
  isDeleted: boolean;
}

async function resolveResourceNames(
  items: { resourceType: string; resourceId: string }[]
): Promise<Map<string, ResourceName>> {
  const map = new Map<string, ResourceName>();
  const fileIds: Types.ObjectId[] = [];
  const folderIds: Types.ObjectId[] = [];

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.resourceId)) continue;
    const id = new mongoose.Types.ObjectId(item.resourceId);
    if (item.resourceType === 'file') fileIds.push(id);
    else if (item.resourceType === 'folder') folderIds.push(id);
  }

  const [files, folders] = await Promise.all([
    fileIds.length
      ? FileModel.find({ _id: { $in: fileIds } }, { name: 1, isDeleted: 1 }).lean()
      : Promise.resolve([]),
    folderIds.length
      ? FolderModel.find({ _id: { $in: folderIds } }, { name: 1, isDeleted: 1 }).lean()
      : Promise.resolve([]),
  ]);

  for (const file of files) {
    map.set(`file:${file._id.toString()}`, { name: file.name, isDeleted: file.isDeleted });
  }
  for (const folder of folders) {
    map.set(`folder:${folder._id.toString()}`, { name: folder.name, isDeleted: folder.isDeleted });
  }

  return map;
}

async function ensureUser(userId: Types.ObjectId): Promise<{ id: string; email: string }> {
  const user = await UserModel.findById(userId, { email: 1 }).lean();
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }
  return { id: user._id.toString(), email: user.email };
}

export class ReportService {
  async filesByCategory() {
    const data = await FileModel.aggregate<{
      category: string;
      count: number;
      sizeBytes: number;
    }>([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          sizeBytes: { $sum: '$size' },
        },
      },
      { $project: { _id: 0, category: '$_id', count: 1, sizeBytes: 1 } },
      { $sort: { category: 1 } },
    ]);

    return {
      data,
      totalFiles: data.reduce((sum, row) => sum + row.count, 0),
      totalBytes: data.reduce((sum, row) => sum + row.sizeBytes, 0),
    };
  }

  async filesByDate(query: { from?: unknown; to?: unknown; page?: unknown; limit?: unknown }) {
    const { from, to } = toRange(query.from, query.to);
    const page = toPage(query.page);
    const limit = toLimit(query.limit, 20, 100);

    const [result] = await FileModel.aggregate<{
      data: {
        id: string;
        name: string;
        category: string;
        size: number;
        ownerId: string;
        ownerEmail: string | null;
        createdAt: Date;
      }[];
      total: { value: number }[];
      summary: { totalBytes: number }[];
    }>([
      { $match: { isDeleted: false, createdAt: { $gte: from, $lte: to } } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'ownerId',
                foreignField: '_id',
                as: 'owner',
              },
            },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                name: 1,
                category: 1,
                size: 1,
                ownerId: { $toString: '$ownerId' },
                ownerEmail: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: 'value' }],
          summary: [{ $group: { _id: null, totalBytes: { $sum: '$size' } } }],
        },
      },
    ]);

    const total = result?.total[0]?.value ?? 0;
    return {
      data: result?.data ?? [],
      total,
      page,
      limit,
      summary: { count: total, totalBytes: result?.summary[0]?.totalBytes ?? 0 },
    };
  }

  async topFilesByOperations(query: { limit?: unknown; from?: unknown; to?: unknown }) {
    const limit = toLimit(query.limit, 10, 100);
    const range = optionalRange(query.from, query.to);
    const match: Record<string, unknown> = { resourceType: 'file', status: 'success' };
    if (range) match.timestamp = range;

    const db = (dbConn.connection?.db ?? mongoose.connection?.db);
    if (!db) return [];
    const activity = db.collection('activity_logs');
    const pipeline = [
      { $match: match },
      { $sort: { timestamp: 1 } as const },
      {
        $group: {
          _id: '$resourceId',
          operations: { $sum: 1 },
          lastOperationAt: { $max: '$timestamp' },
          snapshotName: { $last: '$resourceSnapshot.name' },
        },
      },
      { $sort: { operations: -1, _id: 1 } as const },
      { $limit: limit },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: '_id',
          as: 'file',
        },
      },
      { $unwind: { path: '$file', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'file.ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 0,
          fileId: { $toString: '$_id' },
          name: {
            $ifNull: ['$file.name', { $ifNull: ['$snapshotName', 'Archivo no disponible'] }],
          },
          operations: 1,
          lastOperationAt: 1,
          exists: { $ne: [{ $ifNull: ['$file._id', null] }, null] },
          isDeleted: { $ifNull: ['$file.isDeleted', false] },
          category: { $ifNull: ['$file.category', null] },
          ownerEmail: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
        },
      },
    ] as any[];
    return activity.aggregate(pipeline).toArray() as Promise<any[]>;
  }

  async topUsersByFiles() {
    return FileModel.aggregate<{
      ownerId: string;
      email: string | null;
      isActive: boolean | null;
      role: string | null;
      fileCount: number;
      totalBytes: number;
    }>([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$ownerId',
          fileCount: { $sum: 1 },
          totalBytes: { $sum: '$size' },
        },
      },
      { $sort: { fileCount: -1, _id: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 0,
          ownerId: { $toString: '$_id' },
          email: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
          isActive: { $ifNull: [{ $arrayElemAt: ['$owner.isActive', 0] }, null] },
          role: { $ifNull: [{ $arrayElemAt: ['$owner.role', 0] }, null] },
          fileCount: 1,
          totalBytes: 1,
        },
      },
    ]);
  }

  async topUsersBySharedResources(query: { limit?: unknown }) {
    const limit = toLimit(query.limit, 10, 100);
    return ShareModel.aggregate<{
      ownerId: string;
      email: string | null;
      sharedCount: number;
      manualCount: number;
      autoCount: number;
    }>([
      {
        $group: {
          _id: {
            ownerId: '$ownerId',
            resourceType: '$resourceType',
            resourceId: '$resourceId',
          },
          origins: { $addToSet: '$origin' },
        },
      },
      {
        $group: {
          _id: '$_id.ownerId',
          sharedCount: { $sum: 1 },
          manualCount: { $sum: { $cond: [{ $in: ['manual', '$origins'] }, 1, 0] } },
          autoCount: { $sum: { $cond: [{ $in: ['auto', '$origins'] }, 1, 0] } },
        },
      },
      { $sort: { sharedCount: -1, _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 0,
          ownerId: { $toString: '$_id' },
          email: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
          sharedCount: 1,
          manualCount: 1,
          autoCount: 1,
        },
      },
    ]);
  }

  async topSharedFiles(query: { limit?: unknown }) {
    const limit = toLimit(query.limit, 10, 100);
    return ShareModel.aggregate<{
      fileId: string;
      name: string;
      sharedWithCount: number;
      ownerEmail: string | null;
      isDeleted: boolean;
      lastSharedAt: Date;
    }>([
      { $match: { resourceType: 'file', origin: 'manual' } },
      {
        $group: {
          _id: '$resourceId',
          sharedWithIds: { $addToSet: '$sharedWithId' },
          lastSharedAt: { $max: '$createdAt' },
        },
      },
      { $project: { sharedWithCount: { $size: '$sharedWithIds' }, lastSharedAt: 1 } },
      { $sort: { sharedWithCount: -1, _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: '_id',
          as: 'file',
        },
      },
      { $unwind: { path: '$file', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'file.ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      {
        $project: {
          _id: 0,
          fileId: { $toString: '$_id' },
          name: { $ifNull: ['$file.name', 'Archivo no disponible'] },
          sharedWithCount: 1,
          ownerEmail: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
          isDeleted: { $ifNull: ['$file.isDeleted', false] },
          lastSharedAt: 1,
        },
      },
    ]);
  }

  async sharedByUser(
    userIdValue: unknown,
    query: { page?: unknown; limit?: unknown }
  ) {
    const userId = toObjectId(userIdValue, 'userId');
    await ensureUser(userId);
    const page = toPage(query.page);
    const limit = toLimit(query.limit, 20, 100);

    const [result] = await ShareModel.aggregate<{
      data: {
        resourceType: string;
        resourceId: Types.ObjectId;
        recipientCount: number;
        origins: string[];
        lastSharedAt: Date;
      }[];
      total: { value: number }[];
    }>([
      { $match: { ownerId: userId } },
      {
        $group: {
          _id: { resourceType: '$resourceType', resourceId: '$resourceId' },
          recipientIds: { $addToSet: '$sharedWithId' },
          origins: { $addToSet: '$origin' },
          lastSharedAt: { $max: '$createdAt' },
        },
      },
      { $sort: { lastSharedAt: -1, '_id.resourceType': 1, '_id.resourceId': 1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                resourceType: '$_id.resourceType',
                resourceId: '$_id.resourceId',
                recipientCount: { $size: '$recipientIds' },
                origins: 1,
                lastSharedAt: 1,
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    ]);

    const rows = result?.data ?? [];
    const names = await resolveResourceNames(
      rows.map((row) => ({
        resourceType: row.resourceType,
        resourceId: row.resourceId.toString(),
      }))
    );

    return {
      data: rows.map((row) => {
        const name = names.get(`${row.resourceType}:${row.resourceId.toString()}`);
        return {
          resourceType: row.resourceType,
          resourceId: row.resourceId.toString(),
          name: name?.name ?? 'Recurso no disponible',
          isDeleted: name?.isDeleted ?? true,
          recipientCount: row.recipientCount,
          origins: row.origins,
          lastSharedAt: row.lastSharedAt,
        };
      }),
      total: result?.total[0]?.value ?? 0,
      page,
      limit,
    };
  }

  async receivedByUser(
    userIdValue: unknown,
    query: { page?: unknown; limit?: unknown }
  ) {
    const userId = toObjectId(userIdValue, 'userId');
    await ensureUser(userId);
    const page = toPage(query.page);
    const limit = toLimit(query.limit, 20, 100);

    const [result] = await ShareModel.aggregate<{
      data: {
        resourceType: string;
        resourceId: Types.ObjectId;
        ownerId: Types.ObjectId;
        ownerEmail: string | null;
        permission: string;
        origin: string;
        createdAt: Date;
      }[];
      total: { value: number }[];
    }>([
      { $match: { sharedWithId: userId } },
      { $sort: { createdAt: -1, _id: 1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'ownerId',
                foreignField: '_id',
                as: 'owner',
              },
            },
            {
              $project: {
                _id: 0,
                resourceType: 1,
                resourceId: 1,
                ownerId: 1,
                ownerEmail: { $ifNull: [{ $arrayElemAt: ['$owner.email', 0] }, null] },
                permission: 1,
                origin: 1,
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    ]);

    const rows = result?.data ?? [];
    const names = await resolveResourceNames(
      rows.map((row) => ({
        resourceType: row.resourceType,
        resourceId: row.resourceId.toString(),
      }))
    );

    return {
      data: rows.map((row) => {
        const name = names.get(`${row.resourceType}:${row.resourceId.toString()}`);
        return {
          resourceType: row.resourceType,
          resourceId: row.resourceId.toString(),
          name: name?.name ?? 'Recurso no disponible',
          isDeleted: name?.isDeleted ?? true,
          ownerId: row.ownerId.toString(),
          ownerEmail: row.ownerEmail,
          permission: row.permission,
          origin: row.origin,
          sharedAt: row.createdAt,
        };
      }),
      total: result?.total[0]?.value ?? 0,
      page,
      limit,
    };
  }

  async userActivity(
    userIdValue: unknown,
    query: { from?: unknown; to?: unknown; page?: unknown; limit?: unknown }
  ) {
    const userId = toObjectId(userIdValue, 'userId');
    const user = await ensureUser(userId);
    const { from, to } = toRange(query.from, query.to);
    const page = toPage(query.page);
    const limit = toLimit(query.limit, 50, 100);

    const [result] = await ActivityLogModel.aggregate<{
      data: {
        _id: Types.ObjectId;
        action: string;
        resourceType: string;
        resourceId: Types.ObjectId;
        resourceSnapshot: Record<string, unknown>;
        details: Record<string, unknown>;
        timestamp: Date;
      }[];
      total: { value: number }[];
    }>([
      {
        $match: {
          userId,
          status: 'success',
          timestamp: { $gte: from, $lte: to },
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                action: 1,
                resourceType: 1,
                resourceId: 1,
                resourceSnapshot: 1,
                details: 1,
                timestamp: 1,
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    ]);

    return {
      data: (result?.data ?? []).map((row) => ({
        id: row._id.toString(),
        userEmail: user.email,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId.toString(),
        resourceSnapshot: row.resourceSnapshot ?? {},
        details: row.details ?? {},
        timestamp: row.timestamp,
      })),
      total: result?.total[0]?.value ?? 0,
      page,
      limit,
      user,
    };
  }

  async operationsByAction() {
    const data = await ActivityLogModel.aggregate<{ action: string; count: number }>([
      { $match: { status: 'success' } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, action: '$_id', count: 1 } },
    ]);

    return { data, total: data.reduce((sum, row) => sum + row.count, 0) };
  }

  async operationsByPeriod(query: {
    granularity?: unknown;
    from?: unknown;
    to?: unknown;
  }) {
    const granularity =
      query.granularity === 'week' || query.granularity === 'month'
        ? query.granularity
        : 'day';
    const range = optionalRange(query.from, query.to);
    const match: Record<string, unknown> = { status: 'success' };
    if (range) match.timestamp = range;

    const data = await ActivityLogModel.aggregate<{ period: Date; count: number }>([
      { $match: match },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$timestamp',
              unit: granularity,
              timezone: TIMEZONE,
              startOfWeek: 'monday',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: '$_id', count: 1 } },
    ]);

    return {
      data,
      total: data.reduce((sum, row) => sum + row.count, 0),
      granularity,
      timezone: TIMEZONE,
    };
  }

  async listUsers() {
    const users = await UserModel.find(
      {},
      { email: 1, role: 1, isActive: 1 }
    )
      .sort({ emailNormalized: 1 })
      .lean();

    return users.map((user) => ({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }));
  }
}

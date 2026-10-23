import type { Types } from 'mongoose';
import { mongoose } from '../config/db';
import { FileModel } from '../models/file.model';
import { FolderModel } from '../models/folder.model';
import { ShareModel } from '../models/share.model';
import { BadRequestError } from '../errors/http-error';
import { PermissionService } from './permission.service';

export type SearchScope = 'own' | 'shared' | 'all';

export interface Visibility {
  uid: Types.ObjectId;
  sharedFolderIds: Types.ObjectId[];
  sharedFileIds: Types.ObjectId[];
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

function parseScope(value: unknown, fallback: SearchScope = 'all'): SearchScope {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const scope = String(value);
  if (scope !== 'own' && scope !== 'shared' && scope !== 'all') {
    throw new BadRequestError('scope debe ser own, shared o all');
  }
  return scope;
}

export async function resolveVisibility(userId: string): Promise<Visibility> {
  const uid = new mongoose.Types.ObjectId(userId);
  const shares = await ShareModel.find({ sharedWithId: uid }).lean();
  const directFolders = shares
    .filter((share) => share.resourceType === 'folder')
    .map((share) => share.resourceId);
  const sharedFileIds = shares
    .filter((share) => share.resourceType === 'file')
    .map((share) => share.resourceId);
  const descendants = directFolders.length
    ? await FolderModel.find(
        { ancestors: { $in: directFolders }, isDeleted: false },
        { _id: 1 }
      ).lean()
    : [];
  const sharedFolderIds = [
    ...new Set([...directFolders, ...descendants.map((folder) => folder._id)].map((id) => id.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));
  return { uid, sharedFolderIds, sharedFileIds };
}

export function fileScopeFilter(visibility: Visibility, scope: SearchScope): Record<string, unknown> {
  const shared = {
    $or: [
      { _id: { $in: visibility.sharedFileIds } },
      { folderId: { $in: visibility.sharedFolderIds } },
    ],
  };
  if (scope === 'own') {
    return { ownerId: visibility.uid };
  }
  if (scope === 'shared') {
    return shared;
  }
  return { $or: [{ ownerId: visibility.uid }, ...(shared.$or as Array<Record<string, unknown>>)] };
}

export class SearchService {
  private readonly permissions = new PermissionService();

  async search(
    userId: string,
    query: Record<string, unknown>
  ): Promise<{ data: Array<Record<string, unknown>>; total: number; page: number; limit: number }> {
    const q = String(query['q'] ?? '').trim();
    if (!q) {
      throw new BadRequestError('q es obligatorio');
    }
    const scope = parseScope(query['scope']);
    const page = toInt(query['page'], 1);
    const limit = toInt(query['limit'], 50);
    const regex = new RegExp(escapeRegex(q), 'i');
    const visibility = await resolveVisibility(userId);
    const uid = visibility.uid;

    const folderFilter: Record<string, unknown> = { isDeleted: false, nameNormalized: { $regex: regex } };
    if (scope === 'own') {
      folderFilter['ownerId'] = uid;
    } else if (scope === 'shared') {
      folderFilter['_id'] = { $in: visibility.sharedFolderIds };
    } else {
      folderFilter['$or'] = [{ ownerId: uid }, { _id: { $in: visibility.sharedFolderIds } }];
    }

    const fileFilter: Record<string, unknown> = {
      isDeleted: false,
      nameNormalized: { $regex: regex },
      ...fileScopeFilter(visibility, scope),
    };

    const [folders, files] = await Promise.all([
      FolderModel.find(folderFilter).sort({ nameNormalized: 1 }).lean(),
      FileModel.find(fileFilter).sort({ nameNormalized: 1 }).lean(),
    ]);

    const permissions = await this.permissions.effectivePermissionMap(userId, [
      ...folders.map((folder) => ({
        kind: 'folder' as const,
        id: folder._id.toString(),
        ownerId: folder.ownerId.toString(),
        ancestors: folder.ancestors.map((id) => id.toString()),
      })),
      ...files.map((file) => ({
        kind: 'file' as const,
        id: file._id.toString(),
        ownerId: file.ownerId.toString(),
        folderId: file.folderId.toString(),
      })),
    ]);

    const results: Array<Record<string, unknown>> = [];
    for (const folder of folders) {
      results.push({
        id: folder._id.toString(),
        kind: 'folder',
        name: folder.name,
        ownerId: folder.ownerId.toString(),
        permission: permissions.get(`folder:${folder._id.toString()}`) ?? null,
        parentId: folder.parentId ? folder.parentId.toString() : null,
        isRoot: folder.isRoot,
        updatedAt: folder.updatedAt,
      });
    }
    for (const file of files) {
      results.push({
        id: file._id.toString(),
        kind: 'file',
        name: file.name,
        mimeType: file.mimeType,
        category: file.category,
        size: file.size,
        folderId: file.folderId.toString(),
        ownerId: file.ownerId.toString(),
        permission: permissions.get(`file:${file._id.toString()}`) ?? null,
        updatedAt: file.updatedAt,
      });
    }

    results.sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
    const total = results.length;
    const start = (page - 1) * limit;
    const data = results.slice(start, start + limit);
    return { data, total, page, limit };
  }

  async filterFiles(
    userId: string,
    query: Record<string, unknown>
  ): Promise<{ data: Array<Record<string, unknown>>; total: number; page: number; limit: number }> {
    const scope = parseScope(query['scope']);
    const page = toInt(query['page'], 1);
    const limit = toInt(query['limit'], 50);
    const category = query['category'] === undefined || query['category'] === '' ? null : String(query['category']);
    if (category !== null && category !== 'TXT' && category !== 'MD') {
      throw new BadRequestError('category debe ser TXT o MD');
    }
    const from = this.parseDate(query['from'], 'from');
    const to = this.parseDate(query['to'], 'to');
    if (from && to && from > to) {
      throw new BadRequestError('from no puede ser posterior a to');
    }
    const visibility = await resolveVisibility(userId);
    const filter: Record<string, unknown> = {
      isDeleted: false,
      ...fileScopeFilter(visibility, scope),
    };
    if (category) {
      filter['category'] = category;
    }
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range['$gte'] = from;
      if (to) range['$lte'] = to;
      filter['createdAt'] = range;
    }
    const [files, total] = await Promise.all([
      FileModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FileModel.countDocuments(filter),
    ]);
    const permissions = await this.permissions.effectivePermissionMap(
      userId,
      files.map((file) => ({
        kind: 'file' as const,
        id: file._id.toString(),
        ownerId: file.ownerId.toString(),
        folderId: file.folderId.toString(),
      }))
    );
    return {
      data: files.map((file) => ({
        id: file._id.toString(),
        kind: 'file',
        name: file.name,
        mimeType: file.mimeType,
        category: file.category,
        size: file.size,
        folderId: file.folderId.toString(),
        ownerId: file.ownerId.toString(),
        permission: permissions.get(`file:${file._id.toString()}`) ?? null,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  private parseDate(value: unknown, field: string): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`${field} debe ser una fecha válida`);
    }
    return date;
  }
}

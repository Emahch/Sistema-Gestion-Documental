import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { normalizeName } from '../utils/normalize';
import type { Folder, PublicFolder } from '../types/folder';
import type { PublicFile } from '../types/file';
import { BadRequestError, ConflictError, ForbiddenError, HttpError, NotFoundError } from '../errors/http-error';
import { PermissionService } from './permission.service';
import { toPublicFile } from './file.service';
import { UserModel } from '../models/user.model';

export interface FolderChildren {
  folders: PublicFolder[];
  files: PublicFile[];
  page: number;
  limit: number;
  totalFolders: number;
  totalFiles: number;
}

function toPage(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, 100);
}

const ownerEmailCache = new Map<string, string | null>();

async function ownerEmailMap(ids: Array<unknown>): Promise<Map<string, string | null>> {
  const objectIds = ids.filter((id): id is Types.ObjectId => id instanceof mongoose.Types.ObjectId);
  const strings = ids
    .filter((id): id is string => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const all = [...new Set([...objectIds, ...strings].map((id) => id.toString()))];
  const map = new Map<string, string | null>();
  const missing = all.filter((id) => !ownerEmailCache.has(id));
  if (missing.length > 0) {
    const users = await UserModel.find({ _id: { $in: missing.map((id) => new mongoose.Types.ObjectId(id)) } }, { email: 1 }).lean();
    for (const user of users) {
      ownerEmailCache.set(user._id.toString(), user.email ?? null);
    }
    for (const id of missing) {
      if (!ownerEmailCache.has(id)) {
        ownerEmailCache.set(id, null);
      }
    }
  }
  for (const id of all) {
    map.set(id, ownerEmailCache.get(id) ?? null);
  }
  return map;
}

function toPublicFolder(
  folder: HydratedDocument<Folder>,
  ownerEmails?: Map<string, string | null>
): PublicFolder {
  const ownerId = folder.ownerId.toString();
  return {
    id: folder._id.toString(),
    ownerId,
    ownerEmail: ownerEmails?.get(ownerId) ?? ownerEmailCache.get(ownerId) ?? null,
    createdBy: folder.createdBy ? folder.createdBy.toString() : null,
    parentId: folder.parentId ? folder.parentId.toString() : null,
    isRoot: folder.isRoot,
    name: folder.name,
    ancestors: folder.ancestors.map((id) => id.toString()),
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export class FolderService {
  private readonly permissions = new PermissionService();

  async root(userId: string): Promise<PublicFolder> {
    const root = await this.readableFolder(userId, null);
    return toPublicFolder(root);
  }

  async listChildren(
    userId: string,
    parentId: string | null,
    pageRaw: unknown,
    limitRaw: unknown
  ): Promise<FolderChildren> {
    const page = toPage(pageRaw, 1);
    const limit = toPage(limitRaw, 20);
    const parent = await this.readableFolder(userId, parentId);
    const folderFilter = { parentId: parent._id, isDeleted: false };
    const fileFilter = { folderId: parent._id, isDeleted: false };
    const [folders, files, totalFolders, totalFiles] = await Promise.all([
      FolderModel.find(folderFilter)
        .sort({ nameNormalized: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FileModel.find(fileFilter)
        .sort({ nameNormalized: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FolderModel.countDocuments(folderFilter),
      FileModel.countDocuments(fileFilter),
    ]);
    const ownerEmails = await ownerEmailMap([
      ...folders.map((folder) => folder.ownerId),
      ...files.map((file) => file.ownerId),
    ]);
    return {
      folders: folders.map((folder) => toPublicFolder(folder, ownerEmails)),
      files: files.map((file) => toPublicFile(file, ownerEmails)),
      page,
      limit,
      totalFolders,
      totalFiles,
    };
  }

  async createFolder(userId: string, parentId: unknown, name: unknown): Promise<PublicFolder> {
    if (typeof parentId !== 'string' || !parentId) {
      throw new BadRequestError('parentId es obligatorio');
    }
    const cleanName = String(name ?? '').trim();
    if (!cleanName) {
      throw new BadRequestError('name es obligatorio');
    }
    const parent = await FolderModel.findById(parentId);
    if (!parent || parent.isDeleted) {
      throw new NotFoundError('Carpeta padre no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', parent._id, 'edit'))) {
      throw new ForbiddenError('Sin acceso a la carpeta padre');
    }
    try {
      const created = await FolderModel.create({
        ownerId: parent.ownerId,
        createdBy: new mongoose.Types.ObjectId(userId),
        parentId: parent._id,
        isRoot: false,
        name: cleanName,
        nameNormalized: normalizeName(cleanName),
        ancestors: [...parent.ancestors, parent._id],
      });
      await ActivityLogModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        action: 'FOLDER_CREATE',
        status: 'success',
        resourceType: 'folder',
        resourceId: created._id,
        resourceSnapshot: { name: created.name },
        details: { parentId: parent._id, createdBy: userId },
        affectedUserIds: [],
      });
      return toPublicFolder(created);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe una carpeta con ese nombre');
      }
      throw err;
    }
  }

  async renameFolder(userId: string, id: string, name: unknown): Promise<PublicFolder> {
    const cleanName = String(name ?? '').trim();
    if (!cleanName) {
      throw new BadRequestError('name es obligatorio');
    }
    const folder = await FolderModel.findById(id);
    if (!folder || folder.isDeleted) {
      throw new NotFoundError('Carpeta no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', folder._id, 'edit'))) {
      throw new ForbiddenError('Sin acceso a la carpeta');
    }
    if (folder.isRoot) {
      throw new BadRequestError('La raíz no puede renombrarse');
    }
    const previousName = folder.name;
    folder.name = cleanName;
    folder.nameNormalized = normalizeName(cleanName);
    try {
      await folder.save();
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe una carpeta con ese nombre');
      }
      throw err;
    }
    await ActivityLogModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      action: 'RENAME',
      status: 'success',
      resourceType: 'folder',
      resourceId: folder._id,
      resourceSnapshot: { name: folder.name },
      details: { previousName, newName: cleanName },
      affectedUserIds: [],
    });
    return toPublicFolder(folder);
  }

  async moveFolder(userId: string, id: string, destinationId: unknown): Promise<PublicFolder> {
    if (typeof destinationId !== 'string' || !destinationId) {
      throw new BadRequestError('destinationId es obligatorio');
    }
    const folder = await this.ownedFolder(userId, id);
    if (folder.isRoot) {
      throw new BadRequestError('La raíz no puede moverse');
    }
    const destination = await FolderModel.findById(destinationId);
    if (!destination || destination.isDeleted) {
      throw new NotFoundError('Carpeta destino no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', destination._id, 'edit'))) {
      throw new ForbiddenError('Sin acceso a la carpeta destino');
    }
    if (destination._id.equals(folder._id)) {
      throw new BadRequestError('No se puede mover una carpeta dentro de sí misma');
    }
    if (destination.ancestors.some((ancestor) => ancestor.equals(folder._id))) {
      throw new BadRequestError('No se puede mover una carpeta dentro de un descendiente');
    }
    const subtreeIds = [folder._id, ...(await this.descendantIds(folder._id))];
    const foreignFiles = await FileModel.countDocuments({
      folderId: { $in: subtreeIds },
      ownerId: { $ne: folder.ownerId },
      isDeleted: false,
    });
    if (foreignFiles > 0) {
      throw new BadRequestError('La carpeta contiene archivos de otros usuarios');
    }
    const previousParentId = folder.parentId;
    const newAncestors = [...destination.ancestors, destination._id];
    const session = await mongoose.startSession();
    try {
      let moved: HydratedDocument<Folder> | undefined;
      await session.withTransaction(async () => {
        folder.parentId = destination._id;
        folder.ancestors = newAncestors;
        await folder.save({ session });
        moved = folder;
        const descendants = await FolderModel.find({ ancestors: folder._id, isDeleted: false }).session(session);
        const rewrites = descendants.map((child) => {
          const position = child.ancestors.findIndex((ancestor) => ancestor.equals(folder._id));
          const rest = position >= 0 ? child.ancestors.slice(position + 1) : [];
          return {
            updateOne: {
              filter: { _id: child._id },
              update: { $set: { ancestors: [...newAncestors, ...rest] } },
            },
          };
        });
        if (rewrites.length > 0) {
          await FolderModel.bulkWrite(rewrites, { session });
        }
        await ActivityLogModel.create(
          [
            {
              userId: new mongoose.Types.ObjectId(userId),
              action: 'MOVE',
              status: 'success',
              resourceType: 'folder',
              resourceId: folder._id,
              resourceSnapshot: { name: folder.name },
              details: { previousFolderId: previousParentId, newFolderId: destination._id },
              affectedUserIds: [],
            },
          ],
          { session, ordered: true }
        );
      });
      if (!moved) {
        throw new HttpError(500, 'No se pudo mover la carpeta');
      }
      return toPublicFolder(moved);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe una carpeta con ese nombre en el destino');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async trashFolder(
    userId: string,
    id: string
  ): Promise<{ deletionId: string; folders: number; files: number }> {
    const folder = await this.ownedFolder(userId, id);
    if (folder.isRoot) {
      throw new BadRequestError('La raíz no puede enviarse a la papelera');
    }
    const descendants = await FolderModel.find({ ancestors: folder._id, isDeleted: false });
    const subtreeIds = [folder._id, ...descendants.map((child) => child._id)];
    const foreignFiles = await FileModel.countDocuments({
      folderId: { $in: subtreeIds },
      ownerId: { $ne: folder.ownerId },
      isDeleted: false,
    });
    if (foreignFiles > 0) {
      throw new BadRequestError('La carpeta contiene archivos de otros usuarios');
    }
    const deletionId = new mongoose.Types.ObjectId();
    const deletedAt = new Date();
    const actorId = new mongoose.Types.ObjectId(userId);
    const affectedFiles = await FileModel.find({ folderId: { $in: subtreeIds }, isDeleted: false }, { _id: 1, name: 1 });
    const session = await mongoose.startSession();
    try {
      let trashedFiles = 0;
      await session.withTransaction(async () => {
        await FolderModel.updateOne(
          { _id: folder._id },
          { $set: { isDeleted: true, deletedAt, deletionId, isDeletionRoot: true } },
          { session }
        );
        if (descendants.length > 0) {
          await FolderModel.updateMany(
            { _id: { $in: descendants.map((child) => child._id) } },
            { $set: { isDeleted: true, deletedAt, deletionId, isDeletionRoot: false } },
            { session }
          );
        }
        const files = await FileModel.updateMany(
          { folderId: { $in: subtreeIds }, isDeleted: false },
          { $set: { isDeleted: true, deletedAt, deletionId, isDeletionRoot: false } },
          { session }
        );
        trashedFiles = files.modifiedCount;
        await ActivityLogModel.create(
          [
            {
              userId: actorId,
              action: 'TRASH',
              status: 'success',
              resourceType: 'folder',
              resourceId: folder._id,
              resourceSnapshot: { name: folder.name },
              details: { deletionId, isDeletionRoot: true },
              affectedUserIds: [],
            },
            ...descendants.map((child) => ({
              userId: actorId,
              action: 'TRASH',
              status: 'success',
              resourceType: 'folder',
              resourceId: child._id,
              resourceSnapshot: { name: child.name },
              details: { deletionId, isDeletionRoot: false },
              affectedUserIds: [],
            })),
            ...affectedFiles.map((file) => ({
              userId: actorId,
              action: 'TRASH',
              status: 'success',
              resourceType: 'file',
              resourceId: file._id,
              resourceSnapshot: { name: file.name },
              details: { deletionId, isDeletionRoot: false },
              affectedUserIds: [],
            })),
          ],
          { session, ordered: true }
        );
      });
      return { deletionId: deletionId.toString(), folders: descendants.length + 1, files: trashedFiles };
    } finally {
      await session.endSession();
    }
  }

  async breadcrumb(userId: string, id: string): Promise<PublicFolder[]> {
    const folder = await this.readableFolder(userId, id);
    const ancestors = await FolderModel.find({ _id: { $in: folder.ancestors }, isDeleted: false });
    const byId = new Map(ancestors.map((ancestor) => [ancestor._id.toString(), ancestor]));
    const chain: HydratedDocument<Folder>[] = [];
    for (const ancestorId of folder.ancestors) {
      const ancestor = byId.get(ancestorId.toString());
      if (ancestor && (await this.permissions.canAccess(userId, 'folder', ancestor._id, 'read'))) {
        chain.push(ancestor);
      }
    }
    return [...chain, folder].map((item) => toPublicFolder(item));
  }

  private async ownedFolder(userId: string, id: string): Promise<HydratedDocument<Folder>> {
    const folder = await FolderModel.findById(id);
    if (!folder || folder.isDeleted) {
      throw new NotFoundError('Carpeta no encontrada');
    }
    if (folder.ownerId.toString() !== userId) {
      throw new ForbiddenError('Sin acceso a la carpeta');
    }
    return folder;
  }

  private async readableFolder(userId: string, id: string | null): Promise<HydratedDocument<Folder>> {
    if (!id) {
      const root = await FolderModel.findOne({ ownerId: new mongoose.Types.ObjectId(userId), isRoot: true });
      if (!root || root.isDeleted) {
        throw new NotFoundError('Carpeta raíz no encontrada');
      }
      return root;
    }
    const folder = await FolderModel.findById(id);
    if (!folder || folder.isDeleted) {
      throw new NotFoundError('Carpeta no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', folder._id, 'read'))) {
      throw new ForbiddenError('Sin acceso a la carpeta');
    }
    return folder;
  }

  private async descendantIds(folderId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const descendants = await FolderModel.find({ ancestors: folderId, isDeleted: false }, { _id: 1 });
    return descendants.map((child) => child._id);
  }
}

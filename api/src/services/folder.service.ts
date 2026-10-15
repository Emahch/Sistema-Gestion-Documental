import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { normalizeName } from '../utils/normalize';
import type { Folder, PublicFolder } from '../types/folder';
import type { PublicFile } from '../types/file';
import { BadRequestError, ConflictError, ForbiddenError, HttpError, NotFoundError } from '../errors/http-error';

export interface FolderChildren {
  folders: PublicFolder[];
  files: PublicFile[];
  page: number;
  limit: number;
}

function toPage(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, 100);
}

function toPublicFolder(folder: HydratedDocument<Folder>): PublicFolder {
  return {
    id: folder._id.toString(),
    ownerId: folder.ownerId.toString(),
    parentId: folder.parentId ? folder.parentId.toString() : null,
    isRoot: folder.isRoot,
    name: folder.name,
    ancestors: folder.ancestors.map((id) => id.toString()),
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export class FolderService {
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
    const [folders, files] = await Promise.all([
      FolderModel.find({ parentId: parent._id, ownerId: parent.ownerId, isDeleted: false })
        .sort({ nameNormalized: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FileModel.find({ folderId: parent._id, ownerId: parent.ownerId, isDeleted: false })
        .sort({ nameNormalized: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return {
      folders: folders.map((folder) => toPublicFolder(folder)),
      files: files.map((file) => ({
        id: file._id.toString(),
        name: file.name,
        mimeType: file.mimeType,
        category: file.category,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
      page,
      limit,
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
    if (parent.ownerId.toString() !== userId) {
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
    const folder = await this.ownedFolder(userId, id);
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
    if (destination.ownerId.toString() !== userId) {
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
          { session }
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

  async breadcrumb(userId: string, id: string): Promise<PublicFolder[]> {
    const folder = await this.ownedFolder(userId, id);
    const ancestors = await FolderModel.find({ _id: { $in: folder.ancestors }, isDeleted: false });
    const byId = new Map(ancestors.map((ancestor) => [ancestor._id.toString(), ancestor]));
    const chain = folder.ancestors
      .map((ancestorId) => byId.get(ancestorId.toString()))
      .filter((ancestor): ancestor is HydratedDocument<Folder> => Boolean(ancestor));
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
    return this.ownedFolder(userId, id);
  }

  private async descendantIds(folderId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const descendants = await FolderModel.find({ ancestors: folderId, isDeleted: false }, { _id: 1 });
    return descendants.map((child) => child._id);
  }
}

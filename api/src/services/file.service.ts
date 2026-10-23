import type { Request, Response } from 'express';
import { Readable } from 'stream';
import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { UserModel } from '../models/user.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { normalizeName } from '../utils/normalize';
import { deleteGridFsObject, parseUpload } from '../utils/upload';
import type { File, PublicFile } from '../types/file';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  PayloadTooLargeError,
} from '../errors/http-error';
import path from 'path';
import { PermissionService, RequiredPermission } from './permission.service';
import { computeAffectedUserIds } from './activity.service';

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

export function toPublicFile(
  file: HydratedDocument<File>,
  ownerEmails?: Map<string, string | null>,
  permission?: 'owner' | 'edit' | 'read' | null
): PublicFile {
  const ownerId = file.ownerId.toString();
  return {
    id: file._id.toString(),
    ownerId,
    ownerEmail: ownerEmails?.get(ownerId) ?? ownerEmailCache.get(ownerId) ?? null,
    permission,
    name: file.name,
    mimeType: file.mimeType,
    category: file.category,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

async function reserveQuota(
  ownerId: Types.ObjectId,
  size: number,
  session: unknown
): Promise<boolean> {
  const result = await UserModel.updateOne(
    {
      _id: ownerId,
      isActive: true,
      $or: [
        { 'storage.quotaBytes': null },
        { $expr: { $lte: [{ $add: ['$storage.usedBytes', size] }, '$storage.quotaBytes'] } },
      ],
    },
    { $inc: { 'storage.usedBytes': size } },
    { session: session as never }
  );
  return result.matchedCount > 0;
}

export class FileService {
  private readonly permissions = new PermissionService();

  async uploadFile(userId: string, req: Request): Promise<PublicFile> {
    const ownerId = new mongoose.Types.ObjectId(userId);
    const me = await UserModel.findById(ownerId);
    if (!me || !me.isActive) {
      throw new NotFoundError('Usuario no encontrado');
    }
    const contentLength = parseInt(String(req.headers['content-length'] ?? ''), 10);
    if (
      Number.isFinite(contentLength) &&
      me.storage.quotaBytes !== null &&
      contentLength > me.storage.quotaBytes - me.storage.usedBytes
    ) {
      throw new PayloadTooLargeError('Cuota excedida');
    }
    const uploaded = await parseUpload(req);
    const folderId = uploaded.fields['folderId'];
    if (!folderId) {
      await deleteGridFsObject(uploaded.gridFsId);
      throw new BadRequestError('folderId es obligatorio');
    }
    const folder = await FolderModel.findById(folderId);
    if (!folder || folder.isDeleted) {
      await deleteGridFsObject(uploaded.gridFsId);
      throw new NotFoundError('Carpeta destino no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', folder._id, 'edit'))) {
      await deleteGridFsObject(uploaded.gridFsId);
      throw new ForbiddenError('Sin acceso a la carpeta destino');
    }
    const cleanName = uploaded.filename.trim();
    const session = await mongoose.startSession();
    try {
      let created: HydratedDocument<File> | undefined;
      await session.withTransaction(async () => {
        const reserved = await reserveQuota(ownerId, uploaded.size, session);
        if (!reserved) {
          throw new PayloadTooLargeError('Cuota excedida');
        }
        [created] = await FileModel.create(
          [
            {
              ownerId,
              folderId: folder._id,
              name: cleanName,
              nameNormalized: normalizeName(cleanName),
              mimeType: uploaded.mimeType,
              category: uploaded.category,
              size: uploaded.size,
              gridFsId: uploaded.gridFsId,
            },
          ],
          { session, ordered: true }
        );
        if (!created) {
          throw new HttpError(500, 'No se pudo crear el archivo');
        }
        const affected = await computeAffectedUserIds({
          actorId: userId,
          resourceType: 'file',
          resourceId: created._id,
          ownerId: created.ownerId,
        });
        await ActivityLogModel.create(
          [
            {
              userId: ownerId,
              userEmail: me.email,
              action: 'UPLOAD',
              status: 'success',
              resourceType: 'file',
              resourceId: created._id,
              resourceSnapshot: { name: created.name },
              details: { gridFsId: uploaded.gridFsId, size: uploaded.size, folderId: folder._id },
              affectedUserIds: affected,
            },
          ],
          { session, ordered: true }
        );
        if (folder.ownerId.toString() !== userId) {
          await ShareModel.findOneAndUpdate(
            { resourceId: created._id, sharedWithId: folder.ownerId },
            {
              $set: { permission: 'edit', origin: 'auto' },
              $setOnInsert: {
                resourceType: 'file',
                resourceId: created._id,
                ownerId,
                sharedWithId: folder.ownerId,
              },
            },
            { new: true, upsert: true, runValidators: true, session }
          );
          await ActivityLogModel.create(
            [
              {
                userId: ownerId,
                action: 'SHARE',
                status: 'success',
                resourceType: 'file',
                resourceId: created._id,
                resourceSnapshot: { name: created.name },
                details: { sharedWithId: folder.ownerId, permission: 'edit', origin: 'auto' },
                affectedUserIds: [folder.ownerId],
              },
            ],
            { session, ordered: true }
          );
        }
      });
      if (!created) {
        throw new HttpError(500, 'No se pudo crear el archivo');
      }
      return toPublicFile(created);
    } catch (err) {
      await deleteGridFsObject(uploaded.gridFsId);
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un archivo con ese nombre');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async getFile(userId: string, id: string): Promise<PublicFile> {
    const file = await this.accessibleFile(userId, id, 'read');
    return toPublicFile(file);
  }

  async downloadFile(userId: string, id: string, res: Response): Promise<Readable> {
    const file = await this.accessibleFile(userId, id, 'read');
    const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
    await ActivityLogModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      userEmail: actorUser?.email ?? null,
      action: 'DOWNLOAD',
      status: 'success',
      resourceType: 'file',
      resourceId: file._id,
      resourceSnapshot: { name: file.name },
      details: { gridFsId: file.gridFsId, size: file.size },
      affectedUserIds: [],
    });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    const db = mongoose.connection.db;
    if (!db) {
      throw new HttpError(500, 'Sin conexión a MongoDB');
    }
    return new mongoose.mongo.GridFSBucket(db).openDownloadStream(file.gridFsId);
  }

  async previewFile(userId: string, id: string, res: Response): Promise<Readable> {
    const file = await this.accessibleFile(userId, id, 'read');
    if (file.category !== 'TXT' && file.category !== 'MD') {
      throw new BadRequestError('La vista previa solo está disponible para TXT y MD');
    }
    const asciiName = file.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', `${file.mimeType}; charset=utf-8`);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`
    );
    const db = mongoose.connection.db;
    if (!db) {
      throw new HttpError(500, 'Sin conexión a MongoDB');
    }
    return new mongoose.mongo.GridFSBucket(db).openDownloadStream(file.gridFsId);
  }

  async logDownloadError(userId: string, id: string, message: string): Promise<void> {
    const file = await FileModel.findById(id);
    if (!file) {
      return;
    }
    const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
    await ActivityLogModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      userEmail: actorUser?.email ?? null,
      action: 'DOWNLOAD',
      status: 'error',
      resourceType: 'file',
      resourceId: file._id,
      resourceSnapshot: { name: file.name },
      details: { gridFsId: file.gridFsId, errorCode: 'GRIDFS_READ_FAILED', message },
      affectedUserIds: [],
    });
  }

  async editContent(userId: string, id: string, req: Request): Promise<PublicFile> {
    const file = await this.accessibleFile(userId, id, 'edit');
    const uploaded = await parseUpload(req);
    const currentExtension = path.extname(file.name).toLowerCase();
    const uploadedExtension = path.extname(uploaded.filename).toLowerCase();
    if (currentExtension !== uploadedExtension) {
      await deleteGridFsObject(uploaded.gridFsId);
      throw new BadRequestError(
        `El archivo de reemplazo debe conservar la extensión ${currentExtension || '(sin extensión)'}`
      );
    }
    const session = await mongoose.startSession();
    const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
    const previousGridFsId = file.gridFsId;
    const previousSize = file.size;
    try {
      let updated: HydratedDocument<File> | undefined;
      await session.withTransaction(async () => {
        const delta = uploaded.size - previousSize;
        if (delta > 0) {
          const reserved = await reserveQuota(file.ownerId, delta, session);
          if (!reserved) {
            throw new PayloadTooLargeError('Cuota excedida');
          }
        } else if (delta < 0) {
          await UserModel.updateOne({ _id: file.ownerId }, { $inc: { 'storage.usedBytes': delta } }, { session });
        }
        const fresh = await FileModel.findByIdAndUpdate(
          file._id,
          { gridFsId: uploaded.gridFsId, size: uploaded.size },
          { new: true, session }
        );
        if (!fresh) {
          throw new NotFoundError('Archivo no encontrado');
        }
        updated = fresh;
        const affected = await computeAffectedUserIds({
          actorId: userId,
          resourceType: 'file',
          resourceId: file._id,
          ownerId: file.ownerId,
        });
        await ActivityLogModel.create(
          [
            {
              userId: new mongoose.Types.ObjectId(userId),
              userEmail: actorUser?.email ?? null,
              action: 'EDIT_CONTENT',
              status: 'success',
              resourceType: 'file',
              resourceId: file._id,
              resourceSnapshot: { name: file.name },
              details: { previousGridFsId, newGridFsId: uploaded.gridFsId, previousSize, newSize: uploaded.size },
              affectedUserIds: affected,
            },
          ],
          { session, ordered: true }
        );
      });
      if (!updated) {
        throw new HttpError(500, 'No se pudo editar el archivo');
      }
      await deleteGridFsObject(previousGridFsId);
      return toPublicFile(updated);
    } catch (err) {
      await deleteGridFsObject(uploaded.gridFsId);
      if (err instanceof HttpError) {
        throw err;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async renameFile(userId: string, id: string, name: unknown): Promise<PublicFile> {
    const cleanName = String(name ?? '').trim();
    if (!cleanName) {
      throw new BadRequestError('name es obligatorio');
    }
    const file = await this.accessibleFile(userId, id, 'edit');
    if (path.extname(cleanName).toLowerCase() !== path.extname(file.name).toLowerCase()) {
      throw new BadRequestError('La extensión debe conservarse');
    }
    const previousName = file.name;
    file.name = cleanName;
    file.nameNormalized = normalizeName(cleanName);
    try {
      await file.save();
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un archivo con ese nombre');
      }
      throw err;
    }
    const affected = await computeAffectedUserIds({
      actorId: userId,
      resourceType: 'file',
      resourceId: file._id,
      ownerId: file.ownerId,
    });
    const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
    await ActivityLogModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      userEmail: actorUser?.email ?? null,
      action: 'RENAME',
      status: 'success',
      resourceType: 'file',
      resourceId: file._id,
      resourceSnapshot: { name: file.name },
      details: { previousName, newName: cleanName },
      affectedUserIds: affected,
    });
    return toPublicFile(file);
  }

  async moveFile(userId: string, id: string, destinationId: unknown): Promise<PublicFile> {
    if (typeof destinationId !== 'string' || !destinationId) {
      throw new BadRequestError('destinationId es obligatorio');
    }
    const file = await this.accessibleFile(userId, id, 'edit');
    const origin = await FolderModel.findById(file.folderId);
    if (!origin || origin.isDeleted) {
      throw new NotFoundError('Carpeta de origen no encontrada');
    }
    const destination = await FolderModel.findById(destinationId);
    if (!destination || destination.isDeleted) {
      throw new NotFoundError('Carpeta destino no encontrada');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', destination._id, 'edit'))) {
      throw new ForbiddenError('Sin acceso a la carpeta destino');
    }
    if (destination.ownerId.toString() !== origin.ownerId.toString()) {
      throw new BadRequestError('Prohibido mover entre propietarios distintos');
    }
    file.folderId = destination._id;
    try {
      await file.save();
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un archivo con ese nombre en el destino');
      }
      throw err;
    }
    const affected = await computeAffectedUserIds({
      actorId: userId,
      resourceType: 'file',
      resourceId: file._id,
      ownerId: file.ownerId,
    });
    const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
    await ActivityLogModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      userEmail: actorUser?.email ?? null,
      action: 'MOVE',
      status: 'success',
      resourceType: 'file',
      resourceId: file._id,
      resourceSnapshot: { name: file.name },
      details: { previousFolderId: origin._id, newFolderId: destination._id },
      affectedUserIds: affected,
    });
    return toPublicFile(file);
  }

  async trashFile(userId: string, id: string): Promise<{ deletionId: string }> {
    const file = await this.ownedFile(userId, id);
    const deletionId = new mongoose.Types.ObjectId();
    const deletedAt = new Date();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await FileModel.updateOne(
          { _id: file._id },
          { $set: { isDeleted: true, deletedAt, deletionId, isDeletionRoot: true } },
          { session }
        );
        const affected = await computeAffectedUserIds({
          actorId: userId,
          resourceType: 'file',
          resourceId: file._id,
          ownerId: file.ownerId,
        });
        const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
        await ActivityLogModel.create(
          [
            {
              userId: new mongoose.Types.ObjectId(userId),
              userEmail: actorUser?.email ?? null,
              action: 'TRASH',
              status: 'success',
              resourceType: 'file',
              resourceId: file._id,
              resourceSnapshot: { name: file.name },
              details: { deletionId, isDeletionRoot: true },
              affectedUserIds: affected,
            },
          ],
          { session, ordered: true }
        );
      });
    } finally {
      await session.endSession();
    }
    return { deletionId: deletionId.toString() };
  }

  private async ownedFile(userId: string, id: string): Promise<HydratedDocument<File>> {
    return this.accessibleFile(userId, id, 'owner');
  }

  private async accessibleFile(
    userId: string,
    id: string,
    required: 'owner' | RequiredPermission
  ): Promise<HydratedDocument<File>> {
    const file = await FileModel.findById(id);
    if (!file || file.isDeleted) {
      throw new NotFoundError('Archivo no encontrado');
    }
    if (required === 'owner') {
      if (file.ownerId.toString() !== userId) {
        throw new ForbiddenError('Sin acceso al archivo');
      }
      return file;
    }
    if (!(await this.permissions.canAccess(userId, 'file', file._id, required))) {
      throw new ForbiddenError('Sin acceso al archivo');
    }
    return file;
  }
}

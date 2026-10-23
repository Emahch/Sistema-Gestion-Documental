import { mongoose } from '../config/db';
import type { HydratedDocument, Types } from 'mongoose';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import { UserModel } from '../models/user.model';
import { ActivityLogModel } from '../models/activity-log.model';
import { deleteGridFsObject } from '../utils/upload';
import type { File } from '../types/file';
import type { Folder } from '../types/folder';
import type {
  DeletedFileRef,
  DeletePermanentResult,
  GroupRow,
  GroupTotals,
  RestoreResult,
  TrashContentItem,
  TrashContents,
  TrashEntry,
  TrashResourceType,
} from '../types/trash';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
} from '../errors/http-error';
import { PermissionService } from './permission.service';
import { computeAffectedUserIds } from './activity.service';

export function keyOf(value: unknown): string {
  return value ? String(value) : '';
}

export function emptyTotals(): GroupTotals {
  return { folders: 0, files: 0, sizeBytes: 0 };
}

export class TrashService {
  private readonly permissions = new PermissionService();

  async list(userId: string): Promise<TrashEntry[]> {
    const ownerId = new mongoose.Types.ObjectId(userId);
    const [folders, files, folderGroups, fileGroups] = await Promise.all([
      FolderModel.find({ ownerId, isDeleted: true, isDeletionRoot: true })
        .sort({ deletedAt: -1 })
        .lean(),
      FileModel.find({ ownerId, isDeleted: true, isDeletionRoot: true })
        .sort({ deletedAt: -1 })
        .lean(),
      FolderModel.aggregate([
        { $match: { ownerId, isDeleted: true } },
        { $group: { _id: '$deletionId', folders: { $sum: 1 } } },
      ]),
      FileModel.aggregate([
        { $match: { ownerId, isDeleted: true } },
        { $group: { _id: '$deletionId', files: { $sum: 1 }, sizeBytes: { $sum: '$size' } } },
      ]),
    ]);

    const totals = new Map<string, GroupTotals>();
    for (const group of folderGroups as GroupRow[]) {
      totals.set(keyOf(group._id), { ...emptyTotals(), folders: group.folders ?? 0 });
    }
    for (const group of fileGroups as GroupRow[]) {
      const current = totals.get(keyOf(group._id)) ?? emptyTotals();
      current.files = group.files ?? 0;
      current.sizeBytes = group.sizeBytes ?? 0;
      totals.set(keyOf(group._id), current);
    }

    const parentIds = [
      ...folders.map((folder) => folder.parentId),
      ...files.map((file) => file.folderId),
    ].filter((id): id is mongoose.Types.ObjectId => id !== null && id !== undefined);
    const parents = await FolderModel.find(
      { _id: { $in: parentIds }, isDeleted: false },
      { name: 1 }
    ).lean();
    const locationNames = new Map(parents.map((parent) => [keyOf(parent._id), parent.name]));

    const entries: TrashEntry[] = [];
    for (const folder of folders) {
      const group = totals.get(keyOf(folder.deletionId)) ?? emptyTotals();
      entries.push({
        id: folder._id.toString(),
        resourceType: 'folder',
        name: folder.name,
        deletedAt: folder.deletedAt ? new Date(folder.deletedAt).toISOString() : '',
        itemCount: group.folders + group.files,
        sizeBytes: group.sizeBytes,
        locationName: locationNames.get(keyOf(folder.parentId)) ?? null,
      });
    }
    for (const file of files) {
      const group = totals.get(keyOf(file.deletionId)) ?? emptyTotals();
      entries.push({
        id: file._id.toString(),
        resourceType: 'file',
        name: file.name,
        deletedAt: file.deletedAt ? new Date(file.deletedAt).toISOString() : '',
        itemCount: group.folders + group.files,
        sizeBytes: group.sizeBytes,
        locationName: locationNames.get(keyOf(file.folderId)) ?? null,
      });
    }
    return entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  }

  async contents(userId: string, id: string): Promise<TrashContents> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('id inválido');
    }
    const root = await FolderModel.findOne({ _id: id, isDeleted: true });
    if (!root) {
      throw new NotFoundError('La carpeta eliminada no existe');
    }
    if (root.ownerId.toString() !== userId) {
      throw new ForbiddenError('Solo el propietario puede ver la papelera');
    }
    const deletionId = root.deletionId;
    if (!deletionId) {
      throw new BadRequestError('El elemento no pertenece a una eliminación');
    }

    const [groupFolders, groupFiles] = await Promise.all([
      FolderModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true }).lean(),
      FileModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true }).lean(),
    ]);

    const subtreeFolders = groupFolders.filter((f) => !f._id.equals(root._id));
    const subtreeFiles = groupFiles.filter((f) => !f._id.equals(root._id));

    const folders: TrashContentItem[] = [];
    for (const folder of subtreeFolders) {
      if (keyOf(folder.parentId) !== keyOf(root._id)) {
        continue;
      }
      const descendants = subtreeFolders.filter((f) => f.ancestors.some((a) => a.equals(folder._id)));
      const descFiles = subtreeFiles.filter(
        (f) => f.folderId.equals(folder._id) || descendants.some((d) => f.folderId.equals(d._id))
      );
      const sizeBytes = descFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      folders.push({
        id: folder._id.toString(),
        resourceType: 'folder',
        name: folder.name,
        deletedAt: folder.deletedAt ? new Date(folder.deletedAt).toISOString() : '',
        sizeBytes,
        itemCount: descendants.length + 1 + descFiles.length,
      });
    }

    const files: TrashContentItem[] = [];
    for (const file of subtreeFiles) {
      if (keyOf(file.folderId) !== keyOf(root._id)) {
        continue;
      }
      files.push({
        id: file._id.toString(),
        resourceType: 'file',
        name: file.name,
        deletedAt: file.deletedAt ? new Date(file.deletedAt).toISOString() : '',
        sizeBytes: file.size || 0,
        itemCount: 1,
      });
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    return {
      folderId: root._id.toString(),
      name: root.name,
      folders,
      files,
    };
  }

  async restore(userId: string, id: string, destinationId?: string | null): Promise<RestoreResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('id inválido');
    }
    const [folderRoot, fileRoot] = await Promise.all([
      FolderModel.findOne({ _id: id, isDeleted: true, isDeletionRoot: true }),
      FileModel.findOne({ _id: id, isDeleted: true, isDeletionRoot: true }),
    ]);
    const root = folderRoot ?? fileRoot;
    if (!root) {
      throw new NotFoundError('El elemento no está en la papelera');
    }
    if (root.ownerId.toString() !== userId) {
      throw new ForbiddenError('Solo el propietario restaura');
    }
    const deletionId = root.deletionId;
    if (!deletionId) {
      throw new BadRequestError('El elemento no pertenece a una eliminación');
    }
    const resourceType: TrashResourceType = folderRoot ? 'folder' : 'file';

    const destination = destinationId ? await this.loadDestination(userId, destinationId) : null;
    if (destination) {
      await this.checkNameConflict(folderRoot ?? null, fileRoot ?? null, destination._id);
    } else if (folderRoot) {
      await this.checkFolderTarget(folderRoot);
    } else if (fileRoot) {
      await this.checkFileTarget(fileRoot);
    }

    const groupFolders = await FolderModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true });
    const groupFiles = await FileModel.find({ deletionId, ownerId: root.ownerId, isDeleted: true });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (destination && folderRoot) {
          const newAncestors = [...destination.ancestors, destination._id];
          folderRoot.parentId = destination._id;
          folderRoot.ancestors = newAncestors;
          await folderRoot.save({ session });
          const rewrites = groupFolders
            .filter((child) => !child._id.equals(folderRoot._id))
            .map((child) => {
              const position = child.ancestors.findIndex((ancestor) => ancestor.equals(folderRoot._id));
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
        } else if (destination && fileRoot) {
          fileRoot.folderId = destination._id;
          await fileRoot.save({ session });
        }
        await FolderModel.updateMany(
          { deletionId, ownerId: root.ownerId },
          { $set: { isDeleted: false, isDeletionRoot: false }, $unset: { deletedAt: 1, deletionId: 1 } },
          { session }
        );
        await FileModel.updateMany(
          { deletionId, ownerId: root.ownerId },
          { $set: { isDeleted: false, isDeletionRoot: false }, $unset: { deletedAt: 1, deletionId: 1 } },
          { session }
        );
        const folderAffected = await Promise.all(
          groupFolders.map((item) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'folder',
              resourceId: item._id,
              ownerId: item.ownerId,
            })
          )
        );
        const fileAffected = await Promise.all(
          groupFiles.map((item) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'file',
              resourceId: item._id,
              ownerId: item.ownerId,
            })
          )
        );
        const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
        await ActivityLogModel.create(
          [
            ...groupFolders.map((item, idx) => ({
              userId: root.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'RESTORE',
              status: 'success',
              resourceType: 'folder',
              resourceId: item._id,
              resourceSnapshot: { name: item.name },
              details: {
                deletionId,
                previousFolderId: item.parentId,
                destinationFolderId: destination ? destination._id : item.parentId,
              },
              affectedUserIds: folderAffected[idx],
            })),
            ...groupFiles.map((item, idx) => ({
              userId: root.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'RESTORE',
              status: 'success',
              resourceType: 'file',
              resourceId: item._id,
              resourceSnapshot: { name: item.name },
              details: {
                deletionId,
                previousFolderId: item.folderId,
                destinationFolderId: destination ? destination._id : item.folderId,
              },
              affectedUserIds: fileAffected[idx],
            })),
          ],
          { session, ordered: true }
        );
      });
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un elemento con ese nombre');
      }
      throw err;
    } finally {
      await session.endSession();
    }
    return { resourceType, restored: groupFolders.length + groupFiles.length };
  }

  async restoreItem(userId: string, itemId: string, destinationId: string): Promise<RestoreResult> {
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw new BadRequestError('id inválido');
    }
    if (!destinationId || !mongoose.Types.ObjectId.isValid(destinationId)) {
      throw new BadRequestError('destinationId es obligatorio');
    }
    const [folder, file] = await Promise.all([
      FolderModel.findOne({ _id: itemId, isDeleted: true }),
      FileModel.findOne({ _id: itemId, isDeleted: true }),
    ]);
    const item = folder ?? file;
    if (!item) {
      throw new NotFoundError('El elemento no está en la papelera');
    }
    if (item.ownerId.toString() !== userId) {
      throw new ForbiddenError('Solo el propietario restaura');
    }
    if (item.isDeletionRoot) {
      return this.restore(userId, itemId, destinationId);
    }
    const deletionId = item.deletionId;
    if (!deletionId) {
      throw new BadRequestError('El elemento no pertenece a una eliminación');
    }

    const dest = await this.loadDestination(userId, destinationId);
    await this.checkNameConflict(folder ?? null, file ?? null, dest._id);

    const groupFolders = await FolderModel.find({ deletionId, ownerId: item.ownerId, isDeleted: true });
    const groupFiles = await FileModel.find({ deletionId, ownerId: item.ownerId, isDeleted: true });
    const subtreeFolders = folder
      ? groupFolders.filter(
          (f) => f._id.equals(folder._id) || f.ancestors.some((a) => a.equals(folder._id))
        )
      : [];
    const subtreeFiles = folder
      ? groupFiles.filter(
          (f) =>
            f.folderId.equals(folder._id) ||
            subtreeFolders.some((sf) => sf._id.equals(f.folderId))
        )
      : groupFiles.filter((f) => f._id.equals(file?._id));

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (folder) {
          const previousParentId = folder.parentId;
          const newAncestors = [...dest.ancestors, dest._id];
          folder.parentId = dest._id;
          folder.ancestors = newAncestors;
          await folder.save({ session });
          const rewrites = subtreeFolders
            .filter((f) => !f._id.equals(folder._id))
            .map((child) => {
              const position = child.ancestors.findIndex((a) => a.equals(folder._id));
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
          await FolderModel.updateMany(
            { _id: { $in: subtreeFolders.map((f) => f._id) } },
            { $set: { isDeleted: false, isDeletionRoot: false }, $unset: { deletedAt: 1, deletionId: 1 } },
            { session }
          );
          await FileModel.updateMany(
            { _id: { $in: subtreeFiles.map((f) => f._id) } },
            { $set: { isDeleted: false, isDeletionRoot: false }, $unset: { deletedAt: 1, deletionId: 1 } },
            { session }
          );
        const sfFolderAffected = await Promise.all(
          subtreeFolders.map((sf) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'folder',
              resourceId: sf._id,
              ownerId: sf.ownerId,
            })
          )
        );
        const sfFileAffected = await Promise.all(
          subtreeFiles.map((sf) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'file',
              resourceId: sf._id,
              ownerId: sf.ownerId,
            })
          )
        );
        const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
        await ActivityLogModel.create(
          [
            ...subtreeFolders.map((sf, idx) => ({
              userId: item.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'RESTORE',
              status: 'success',
              resourceType: 'folder',
              resourceId: sf._id,
              resourceSnapshot: { name: sf.name },
              details: {
                deletionId,
                previousFolderId: sf._id.equals(folder._id) ? previousParentId : sf.parentId,
                destinationFolderId: dest._id,
              },
              affectedUserIds: sfFolderAffected[idx],
            })),
            ...subtreeFiles.map((sf, idx) => ({
              userId: item.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'RESTORE',
              status: 'success',
              resourceType: 'file',
              resourceId: sf._id,
              resourceSnapshot: { name: sf.name },
              details: { deletionId, previousFolderId: sf.folderId, destinationFolderId: dest._id },
              affectedUserIds: sfFileAffected[idx],
            })),
          ],
          { session, ordered: true }
        );
        } else if (file) {
          const previousFolderId = file.folderId;
          file.folderId = dest._id;
          await file.save({ session });
          await FileModel.updateOne(
            { _id: file._id },
            { $set: { isDeleted: false, isDeletionRoot: false }, $unset: { deletedAt: 1, deletionId: 1 } },
            { session }
          );
          const fileAffected = await computeAffectedUserIds({
            actorId: userId,
            resourceType: 'file',
            resourceId: file._id,
            ownerId: file.ownerId,
          });
          const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
          await ActivityLogModel.create(
            [
              {
                userId: item.ownerId,
                userEmail: actorUser?.email ?? null,
                action: 'RESTORE',
                status: 'success',
                resourceType: 'file',
                resourceId: file._id,
                resourceSnapshot: { name: file.name },
                details: { deletionId, previousFolderId, destinationFolderId: dest._id },
                affectedUserIds: fileAffected,
              },
            ],
            { session, ordered: true }
          );
        }
      });
    } catch (err) {
      if (err instanceof HttpError) {
        throw err;
      }
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un elemento con ese nombre');
      }
      throw err;
    } finally {
      await session.endSession();
    }
    return {
      resourceType: folder ? 'folder' : 'file',
      restored: folder ? subtreeFolders.length + subtreeFiles.length : 1,
    };
  }

  async deletePermanent(userId: string, id: string): Promise<DeletePermanentResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('id inválido');
    }
    const [folderRoot, fileRoot] = await Promise.all([
      FolderModel.findOne({ _id: id, isDeleted: true, isDeletionRoot: true }),
      FileModel.findOne({ _id: id, isDeleted: true, isDeletionRoot: true }),
    ]);
    const root = folderRoot ?? fileRoot;
    if (!root) {
      throw new NotFoundError('El elemento no está en la papelera');
    }
    if (root.ownerId.toString() !== userId) {
      throw new ForbiddenError('Solo el propietario elimina definitivamente');
    }
    const deletionId = root.deletionId;
    if (!deletionId) {
      throw new BadRequestError('El elemento no pertenece a una eliminación');
    }
    const resourceType: TrashResourceType = folderRoot ? 'folder' : 'file';

    const session = await mongoose.startSession();
    let deletedFolders = 0;
    let deletedFiles = 0;
    let freedBytes = 0;
    let deletedFilesForGridFs: DeletedFileRef[] = [];
    try {
      await session.withTransaction(async () => {
        const groupFolders = await FolderModel.find({
          deletionId,
          ownerId: root.ownerId,
          isDeleted: true,
        })
          .session(session)
          .lean();
        const groupFiles = await FileModel.find({
          deletionId,
          ownerId: root.ownerId,
          isDeleted: true,
        })
          .session(session)
          .lean();
        if (groupFolders.length === 0 && groupFiles.length === 0) {
          throw new NotFoundError('El elemento no está en la papelera');
        }

        const freedByOwner = new Map<string, number>();
        for (const file of groupFiles) {
          const ownerKey = file.ownerId.toString();
          freedByOwner.set(ownerKey, (freedByOwner.get(ownerKey) ?? 0) + file.size);
        }
        const folderIds = groupFolders.map((folder) => folder._id);
        const fileIds = groupFiles.map((file) => file._id);

        for (const [ownerKey, size] of freedByOwner) {
          if (size > 0) {
            await UserModel.updateOne(
              { _id: ownerKey },
              { $inc: { 'storage.usedBytes': -size } },
              { session }
            );
          }
        }
        await ShareModel.deleteMany(
          {
            $or: [
              { resourceType: 'folder', resourceId: { $in: folderIds } },
              { resourceType: 'file', resourceId: { $in: fileIds } },
            ],
          },
          { session }
        );
        await FolderModel.deleteMany({ _id: { $in: folderIds } }, { session });
        await FileModel.deleteMany({ _id: { $in: fileIds } }, { session });
        const delFolderAffected = await Promise.all(
          groupFolders.map((item) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'folder',
              resourceId: item._id,
              ownerId: item.ownerId,
            })
          )
        );
        const delFileAffected = await Promise.all(
          groupFiles.map((item) =>
            computeAffectedUserIds({
              actorId: userId,
              resourceType: 'file',
              resourceId: item._id,
              ownerId: item.ownerId,
            })
          )
        );
        const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
        await ActivityLogModel.create(
          [
            ...groupFolders.map((item, idx) => ({
              userId: root.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'DELETE_PERMANENT',
              status: 'success',
              resourceType: 'folder',
              resourceId: item._id,
              resourceSnapshot: { name: item.name },
              details: { deletionId },
              affectedUserIds: delFolderAffected[idx],
            })),
            ...groupFiles.map((item, idx) => ({
              userId: root.ownerId,
              userEmail: actorUser?.email ?? null,
              action: 'DELETE_PERMANENT',
              status: 'success',
              resourceType: 'file',
              resourceId: item._id,
              resourceSnapshot: { name: item.name },
              details: { deletionId, gridFsId: item.gridFsId, size: item.size },
              affectedUserIds: delFileAffected[idx],
            })),
          ],
          { session, ordered: true }
        );

        deletedFolders = groupFolders.length;
        deletedFiles = groupFiles.length;
        freedBytes = groupFiles.reduce((sum, file) => sum + file.size, 0);
        deletedFilesForGridFs = groupFiles;
      });
    } finally {
      await session.endSession();
    }

    await this.deleteGridFsContents(userId, deletionId, deletedFilesForGridFs);
    return { resourceType, deleted: deletedFolders + deletedFiles, freedBytes };
  }

  private async deleteGridFsContents(
    userId: string,
    deletionId: Types.ObjectId,
    files: DeletedFileRef[]
  ): Promise<void> {
    for (const file of files) {
      try {
        await deleteGridFsObject(file.gridFsId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        const affected = await computeAffectedUserIds({
          actorId: userId,
          resourceType: 'file',
          resourceId: file._id,
          ownerId: file.ownerId,
        }).catch(() => []);
        const actorUser = await UserModel.findById(userId, { email: 1 }).lean().catch(() => null);
        await ActivityLogModel.create({
          userId: new mongoose.Types.ObjectId(userId),
          userEmail: actorUser?.email ?? null,
          action: 'DELETE_PERMANENT',
          status: 'error',
          resourceType: 'file',
          resourceId: file._id,
          resourceSnapshot: { name: file.name },
          details: {
            deletionId,
            gridFsId: file.gridFsId,
            errorCode: 'GRIDFS_DELETE_FAILED',
            message,
          },
          affectedUserIds: affected,
        }).catch(() => undefined);
      }
    }
  }

  private async loadDestination(
    userId: string,
    destinationId: string
  ): Promise<HydratedDocument<Folder>> {
    if (!mongoose.Types.ObjectId.isValid(destinationId)) {
      throw new BadRequestError('id inválido');
    }
    const destination = await FolderModel.findById(destinationId);
    if (!destination || destination.isDeleted) {
      throw new NotFoundError('Carpeta destino no encontrada');
    }
    if (destination.ownerId.toString() !== userId) {
      throw new BadRequestError('El destino debe pertenecer al mismo propietario');
    }
    if (!(await this.permissions.canAccess(userId, 'folder', destination._id, 'edit'))) {
      throw new ForbiddenError('Sin acceso a la carpeta destino');
    }
    return destination;
  }

  private async checkNameConflict(
    folder: HydratedDocument<Folder> | null,
    file: HydratedDocument<File> | null,
    destinationId: Types.ObjectId
  ): Promise<void> {
    if (folder) {
      const conflict = await FolderModel.findOne({
        parentId: destinationId,
        nameNormalized: folder.nameNormalized,
        isDeleted: false,
      });
      if (conflict) {
        throw new ConflictError('Ya existe una carpeta con ese nombre');
      }
      return;
    }
    if (file) {
      const conflict = await FileModel.findOne({
        folderId: destinationId,
        nameNormalized: file.nameNormalized,
        isDeleted: false,
      });
      if (conflict) {
        throw new ConflictError('Ya existe un archivo con ese nombre');
      }
    }
  }

  private async checkFolderTarget(folder: HydratedDocument<Folder>): Promise<void> {
    const parentId = folder.parentId;
    if (!parentId) {
      throw new BadRequestError('La carpeta padre ya no está disponible');
    }
    const parent = await FolderModel.findById(parentId);
    if (!parent || parent.isDeleted) {
      throw new BadRequestError('La carpeta padre ya no está disponible');
    }
    const conflict = await FolderModel.findOne({
      parentId: parent._id,
      nameNormalized: folder.nameNormalized,
      isDeleted: false,
    });
    if (conflict) {
      throw new ConflictError('Ya existe una carpeta con ese nombre');
    }
  }

  private async checkFileTarget(file: HydratedDocument<File>): Promise<void> {
    const folder = await FolderModel.findById(file.folderId);
    if (!folder || folder.isDeleted) {
      throw new BadRequestError('La carpeta del archivo ya no está disponible');
    }
    const conflict = await FileModel.findOne({
      folderId: folder._id,
      nameNormalized: file.nameNormalized,
      isDeleted: false,
    });
    if (conflict) {
      throw new ConflictError('Ya existe un archivo con ese nombre');
    }
  }
}

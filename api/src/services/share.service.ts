import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { mongoose } from '../config/db';
import { UserModel } from '../models/user.model';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import type { Share, ShareOrigin, SharePermission } from '../types/share';
import type { Folder } from '../types/folder';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
} from '../errors/http-error';
import { PermissionService, ResourceType } from './permission.service';
import { computeAffectedUserIds } from './activity.service';
import { createActivityLog } from '../utils/activity-log';

export interface ShareInput {
  resourceType: unknown;
  resourceId: unknown;
  sharedWithId: unknown;
  permission: unknown;
}

export interface PublicShare {
  id: string;
  resourceType: string;
  resourceId: string;
  ownerId: string;
  ownerEmail: string;
  sharedWithId: string;
  sharedWithEmail: string;
  permission: SharePermission;
  origin: ShareOrigin;
  resourceName: string;
  createdAt: Date;
}

export interface PagedShares {
  data: PublicShare[];
  total: number;
  page: number;
  limit: number;
}

function toPage(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : Math.min(parsed, 100);
}

function toObjectId(value: unknown, field: string): Types.ObjectId {
  if (typeof value !== 'string' || !value || !Types.ObjectId.isValid(value)) {
    throw new BadRequestError(`${field} inválido`);
  }
  return new Types.ObjectId(value);
}

function toPublicShare(
  share: HydratedDocument<Share>,
  resourceName: string,
  ownerEmail: string,
  sharedWithEmail: string
): PublicShare {
  return {
    id: share._id.toString(),
    resourceType: share.resourceType,
    resourceId: share.resourceId.toString(),
    ownerId: share.ownerId.toString(),
    ownerEmail,
    sharedWithId: share.sharedWithId.toString(),
    sharedWithEmail,
    permission: share.permission,
    origin: share.origin,
    resourceName,
    createdAt: share.createdAt,
  };
}

export class ShareService {
  private readonly permissions = new PermissionService();

  async shareResource(
    ownerId: string,
    input: ShareInput,
    origin: ShareOrigin = 'manual'
  ): Promise<{ share: PublicShare; created: boolean }> {
    const { resourceType, resourceId, sharedWithId, permission } = input;
    if (resourceType !== 'file' && resourceType !== 'folder') {
      throw new BadRequestError('resourceType debe ser file o folder');
    }
    if (typeof resourceId !== 'string' || !resourceId) {
      throw new BadRequestError('resourceId es obligatorio');
    }
    if (typeof sharedWithId !== 'string' || !sharedWithId) {
      throw new BadRequestError('sharedWithId es obligatorio');
    }
    if (permission !== 'read' && permission !== 'edit') {
      throw new BadRequestError('permission debe ser read o edit');
    }
    if (sharedWithId === ownerId) {
      throw new BadRequestError('No puedes compartir contigo mismo');
    }
    const resourceObjectId = toObjectId(resourceId, 'resourceId');
    const targetObjectId = toObjectId(sharedWithId, 'sharedWithId');
    const ownerObjectId = toObjectId(ownerId, 'ownerId');
    const [target, owner] = await Promise.all([
      UserModel.findById(targetObjectId),
      UserModel.findById(ownerObjectId),
    ]);
    if (!target) {
      throw new NotFoundError('Usuario destino no encontrado');
    }
    if (!target.isActive) {
      throw new BadRequestError('No se puede compartir con un usuario inactivo');
    }
    const found = await this.permissions.findResource(resourceType, resourceObjectId.toString());
    if (!found) {
      throw new NotFoundError('Recurso no encontrado');
    }
    const { doc } = found;
    if (doc.isDeleted) {
      throw new BadRequestError('No se puede compartir un recurso eliminado');
    }
    if (doc.ownerId.toString() !== ownerId) {
      throw new ForbiddenError('Solo el propietario puede compartir');
    }
    if (resourceType === 'folder' && (doc as HydratedDocument<Folder>).isRoot) {
      throw new BadRequestError('La raíz no puede compartirse');
    }
    try {
      const result = await ShareModel.findOneAndUpdate(
        { resourceId: doc._id, sharedWithId: targetObjectId },
        {
          $set: { permission, origin },
          $setOnInsert: { resourceType, resourceId: doc._id, ownerId: ownerObjectId, sharedWithId: targetObjectId },
        },
        { new: true, upsert: true, runValidators: true, includeResultMetadata: true }
      );
      const share = result.value;
      if (!share) {
        throw new HttpError(500, 'No se pudo crear el share');
      }
        const affected = await computeAffectedUserIds({
          actorId: ownerId,
          resourceType: resourceType === 'folder' ? 'folder' : 'file',
          resourceId: doc._id,
          ownerId: doc.ownerId,
        });
        await createActivityLog({
          actorId: ownerId,
          action: 'SHARE',
          status: 'success',
          resourceType: resourceType === 'folder' ? 'folder' : 'file',
          resourceId: doc._id,
          resourceSnapshot: { name: doc.name },
          details: { sharedWithId: targetObjectId, permission, origin },
          affectedUserIds: affected,
        });
      const created = !result.lastErrorObject?.updatedExisting;
      return {
        share: toPublicShare(share, doc.name, owner?.email ?? '', target.email),
        created,
      };
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: number }).code === 11000) {
        throw new ConflictError('Ya existe un share para ese usuario');
      }
      throw err;
    }
  }

  async updatePermission(
    ownerId: string,
    input: { resourceId: unknown; sharedWithId: unknown; permission: unknown }
  ): Promise<PublicShare> {
    const { resourceId, sharedWithId, permission } = input;
    if (typeof resourceId !== 'string' || !resourceId || typeof sharedWithId !== 'string' || !sharedWithId) {
      throw new BadRequestError('resourceId y sharedWithId son obligatorios');
    }
    if (permission !== 'read' && permission !== 'edit') {
      throw new BadRequestError('permission debe ser read o edit');
    }
    const resourceObjectId = toObjectId(resourceId, 'resourceId');
    const targetObjectId = toObjectId(sharedWithId, 'sharedWithId');
    const share = await ShareModel.findOne({ resourceId: resourceObjectId, sharedWithId: targetObjectId });
    if (!share) {
      throw new NotFoundError('Share no encontrado');
    }
    if (share.ownerId.toString() !== ownerId) {
      throw new ForbiddenError('Solo el propietario administra permisos');
    }
    share.permission = permission;
    await share.save();
    const resource = await this.permissions.findResource(share.resourceType, String(share.resourceId));
    const [target, owner] = await Promise.all([
      UserModel.findById(share.sharedWithId),
      UserModel.findById(share.ownerId),
    ]);
    const affected = await computeAffectedUserIds({
      actorId: ownerId,
      resourceType: share.resourceType === 'folder' ? 'folder' : 'file',
      resourceId: share.resourceId,
      ownerId: share.ownerId,
    });
    await createActivityLog({
      actorId: ownerId,
      action: 'PERMISSION_CHANGE',
      status: 'success',
      resourceType: share.resourceType === 'folder' ? 'folder' : 'file',
      resourceId: share.resourceId,
      resourceSnapshot: { name: resource?.doc.name ?? '' },
      details: { sharedWithId: share.sharedWithId, permission },
      affectedUserIds: affected,
    });
    return toPublicShare(share, resource?.doc.name ?? '', owner?.email ?? '', target?.email ?? '');
  }

  async removeShare(ownerId: string, input: { resourceId: unknown; sharedWithId: unknown }): Promise<void> {
    const { resourceId, sharedWithId } = input;
    if (typeof resourceId !== 'string' || !resourceId || typeof sharedWithId !== 'string' || !sharedWithId) {
      throw new BadRequestError('resourceId y sharedWithId son obligatorios');
    }
    const resourceObjectId = toObjectId(resourceId, 'resourceId');
    const targetObjectId = toObjectId(sharedWithId, 'sharedWithId');
    const share = await ShareModel.findOne({ resourceId: resourceObjectId, sharedWithId: targetObjectId });
    if (!share) {
      throw new NotFoundError('Share no encontrado');
    }
    if (share.ownerId.toString() !== ownerId) {
      throw new ForbiddenError('Solo el propietario administra permisos');
    }
    if (share.resourceType === 'folder') {
      const blocked = await this.folderHasForeignFiles(share.resourceId);
      if (blocked) {
        throw new BadRequestError('La carpeta contiene archivos de otros usuarios');
      }
    }
    const resource = await this.permissions.findResource(share.resourceType, String(share.resourceId));
    await ShareModel.deleteOne({ _id: share._id });
    const affected = await computeAffectedUserIds({
      actorId: ownerId,
      resourceType: share.resourceType === 'folder' ? 'folder' : 'file',
      resourceId: share.resourceId,
      ownerId: share.ownerId,
    });
    await createActivityLog({
      actorId: ownerId,
      action: 'UNSHARE',
      status: 'success',
      resourceType: share.resourceType === 'folder' ? 'folder' : 'file',
      resourceId: share.resourceId,
      resourceSnapshot: { name: resource?.doc.name ?? '' },
      details: { sharedWithId: share.sharedWithId },
      affectedUserIds: affected,
    });
  }

  async listForResource(
    userId: string,
    resourceType: unknown,
    resourceId: unknown
  ): Promise<PublicShare[]> {
    if (resourceType !== 'file' && resourceType !== 'folder') {
      throw new BadRequestError('resourceType debe ser file o folder');
    }
    if (typeof resourceId !== 'string' || !resourceId) {
      throw new BadRequestError('resourceId es obligatorio');
    }
    const resourceObjectId = toObjectId(resourceId, 'resourceId');
    const found = await this.permissions.findResource(resourceType, resourceObjectId.toString());
    if (!found) {
      throw new NotFoundError('Recurso no encontrado');
    }
    const { doc } = found;
    if (doc.isDeleted) {
      throw new BadRequestError('El recurso está eliminado');
    }
    if (doc.ownerId.toString() !== userId) {
      throw new ForbiddenError('Solo el propietario administra permisos');
    }
    const shares = await ShareModel.find({ resourceId: resourceObjectId });
    if (shares.length === 0) {
      return [];
    }
    const targetIds = [...new Set(shares.map((share) => share.sharedWithId.toString()))];
    const [owner, targets] = await Promise.all([
      UserModel.findById(doc.ownerId),
      UserModel.find({ _id: { $in: targetIds } }),
    ]);
    const emails = new Map(targets.map((user) => [user._id.toString(), user.email]));
    return shares.map((share) =>
      toPublicShare(
        share,
        doc.name,
        owner?.email ?? '',
        emails.get(share.sharedWithId.toString()) ?? ''
      )
    );
  }

  async sharedWithMe(
    userId: string,
    pageRaw: unknown,
    limitRaw: unknown
  ): Promise<PagedShares> {
    return this.listShares({ sharedWithId: new mongoose.Types.ObjectId(userId) }, pageRaw, limitRaw);
  }

  async sharedByMe(
    userId: string,
    pageRaw: unknown,
    limitRaw: unknown
  ): Promise<PagedShares> {
    return this.listShares(
      { ownerId: new mongoose.Types.ObjectId(userId), origin: 'manual' },
      pageRaw,
      limitRaw
    );
  }

  private async listShares(
    filter: Record<string, unknown>,
    pageRaw: unknown,
    limitRaw: unknown
  ): Promise<PagedShares> {
    const page = toPage(pageRaw, 1);
    const limit = toPage(limitRaw, 20);
    const shares = await ShareModel.find(filter).sort({ createdAt: -1 });
    const userIds = [...new Set(shares.flatMap((share) => [share.ownerId.toString(), share.sharedWithId.toString()]))];
    const users = await UserModel.find({ _id: { $in: userIds } });
    const emails = new Map(users.map((user) => [user._id.toString(), user.email]));
    const data: PublicShare[] = [];
    for (const share of shares) {
      const resource = await this.permissions.findResource(share.resourceType, String(share.resourceId));
      if (!resource || resource.doc.isDeleted) {
        continue;
      }
      data.push(
        toPublicShare(
          share,
          resource.doc.name,
          emails.get(share.ownerId.toString()) ?? '',
          emails.get(share.sharedWithId.toString()) ?? ''
        )
      );
    }
    return { data: data.slice((page - 1) * limit, page * limit), total: data.length, page, limit };
  }

  private async folderHasForeignFiles(resourceId: unknown): Promise<boolean> {
    const folder = await FolderModel.findById(resourceId);
    if (!folder) {
      return false;
    }
    const subtree = await FolderModel.find({ ancestors: folder._id, isDeleted: false }, { _id: 1 });
    const ids = [folder._id, ...subtree.map((child) => child._id)];
    const count = await FileModel.countDocuments({
      folderId: { $in: ids },
      ownerId: { $ne: folder.ownerId },
      isDeleted: false,
    });
    return count > 0;
  }
}

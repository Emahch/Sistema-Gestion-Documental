import type { HydratedDocument, Types } from 'mongoose';
import { FolderModel } from '../models/folder.model';
import { FileModel } from '../models/file.model';
import { ShareModel } from '../models/share.model';
import type { File } from '../types/file';
import type { Folder } from '../types/folder';
import type { SharePermission } from '../types/share';

export type ResourceType = 'file' | 'folder';
export type RequiredPermission = 'read' | 'edit';
export type EffectivePermission = 'owner' | 'edit' | 'read' | null;

export type AnyResource = HydratedDocument<File> | HydratedDocument<Folder>;

export class PermissionService {
  async findResource(resourceType: string, resourceId: string): Promise<{ kind: ResourceType; doc: AnyResource } | null> {
    if (resourceType !== 'file' && resourceType !== 'folder') {
      return null;
    }
    const doc = resourceType === 'file' ? await FileModel.findById(resourceId) : await FolderModel.findById(resourceId);
    if (!doc) {
      return null;
    }
    return { kind: resourceType, doc: doc as AnyResource };
  }

  async effectivePermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string | Types.ObjectId
  ): Promise<EffectivePermission> {
    const found = await this.findResource(resourceType, String(resourceId));
    if (!found) {
      return null;
    }
    const { kind, doc } = found;
    if (doc.isDeleted) {
      return null;
    }
    if (doc.ownerId.toString() === userId) {
      return 'owner';
    }
    const candidates = [doc._id.toString()];
    if (kind === 'file') {
      candidates.push((doc as HydratedDocument<File>).folderId.toString());
    } else {
      for (const ancestor of (doc as HydratedDocument<Folder>).ancestors) {
        candidates.push(ancestor.toString());
      }
    }
    const shares = await ShareModel.find({ resourceId: { $in: candidates }, sharedWithId: userId });
    let best: 'edit' | 'read' | null = null;
    for (const share of shares) {
      const permission: SharePermission = share.permission;
      if (permission === 'edit') {
        best = 'edit';
      }
      if (permission === 'read') {
        best = 'read';
      }
    }
    return best;
  }

  async canAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string | Types.ObjectId,
    required: RequiredPermission
  ): Promise<boolean> {
    const permission = await this.effectivePermission(userId, resourceType, resourceId);
    if (permission === 'owner') {
      return true;
    }
    if (required === 'read') {
      return permission === 'read' || permission === 'edit';
    }
    return permission === 'edit';
  }
}

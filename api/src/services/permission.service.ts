import type { HydratedDocument, Types } from 'mongoose';
import { mongoose } from '../config/db';
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

  async effectivePermissionMap(
    userId: string,
    resources: Array<{
      kind: ResourceType;
      id: string;
      ownerId: string;
      ancestors?: string[];
      folderId?: string;
    }>
  ): Promise<Map<string, EffectivePermission>> {
    const result = new Map<string, EffectivePermission>();
    const uid = new mongoose.Types.ObjectId(userId);
    const shares = await ShareModel.find({ sharedWithId: uid }).lean();
    const shareMap = new Map<string, SharePermission>();
    for (const share of shares) {
      const id = share.resourceId.toString();
      const current = shareMap.get(id);
      if (current !== 'edit') {
        shareMap.set(id, share.permission);
      }
    }
    const fileFolderIds = [
      ...new Set(
        resources
          .filter((resource) => resource.kind === 'file' && resource.folderId)
          .map((resource) => resource.folderId as string)
      ),
    ];
    const folderAncestors = new Map<string, string[]>();
    if (fileFolderIds.length > 0) {
      const folders = await FolderModel.find(
        { _id: { $in: fileFolderIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { ancestors: 1 }
      ).lean();
      for (const folder of folders) {
        folderAncestors.set(
          folder._id.toString(),
          folder.ancestors.map((ancestor) => ancestor.toString())
        );
      }
    }
    for (const resource of resources) {
      const key = `${resource.kind}:${resource.id}`;
      if (resource.ownerId === userId) {
        result.set(key, 'owner');
        continue;
      }
      const candidates = [resource.id];
      if (resource.kind === 'file' && resource.folderId) {
        candidates.push(resource.folderId);
        candidates.push(...(folderAncestors.get(resource.folderId) ?? []));
      }
      if (resource.kind === 'folder' && resource.ancestors) {
        candidates.push(...resource.ancestors);
      }
      let best: 'edit' | 'read' | null = null;
      for (const candidate of candidates) {
        const permission = shareMap.get(candidate);
        if (permission === 'edit') {
          best = 'edit';
          break;
        }
        if (permission === 'read') {
          best = 'read';
        }
      }
      result.set(key, best);
    }
    return result;
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

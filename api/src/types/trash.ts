import { Types } from "mongoose";

export type TrashResourceType = 'folder' | 'file';

export interface TrashEntry {
  id: string;
  resourceType: TrashResourceType;
  name: string;
  deletedAt: string;
  itemCount: number;
  sizeBytes: number;
  locationName: string | null;
}

export interface TrashContentItem {
  id: string;
  resourceType: TrashResourceType;
  name: string;
  deletedAt: string;
  sizeBytes: number;
  itemCount: number;
}

export interface TrashContents {
  folderId: string;
  name: string;
  folders: TrashContentItem[];
  files: TrashContentItem[];
}

export interface RestoreResult {
  resourceType: TrashResourceType;
  restored: number;
}

export interface DeletePermanentResult {
  resourceType: TrashResourceType;
  deleted: number;
  freedBytes: number;
}

export interface GroupTotals {
  folders: number;
  files: number;
  sizeBytes: number;
}

export interface GroupRow {
  _id: unknown;
  folders?: number;
  files?: number;
  sizeBytes?: number;
}

export interface DeletedFileRef {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  size: number;
  gridFsId: Types.ObjectId;
}
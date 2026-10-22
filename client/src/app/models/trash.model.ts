export type TrashResourceType = 'folder' | 'file';

export interface TrashItem {
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

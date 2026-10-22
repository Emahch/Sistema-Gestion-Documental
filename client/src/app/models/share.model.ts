export interface ShareItem {
  id: string;
  resourceType: string;
  resourceId: string;
  ownerId: string;
  ownerEmail: string;
  sharedWithId: string;
  sharedWithEmail: string;
  permission: string;
  origin: string;
  resourceName: string;
  createdAt: string;
}

export type SharePermission = 'read' | 'edit';

export interface PagedShares {
  data: ShareItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ShareRequest {
  resourceType: 'file' | 'folder';
  resourceId: string;
  sharedWithId: string;
  permission: SharePermission;
}

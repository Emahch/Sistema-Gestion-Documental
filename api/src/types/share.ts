import type { Types } from 'mongoose';

export type SharePermission = 'read' | 'edit';
export type ShareOrigin = 'manual' | 'auto';

export interface Share {
  resourceType: string;
  resourceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sharedWithId: Types.ObjectId;
  permission: SharePermission;
  origin: ShareOrigin;
  createdAt: Date;
}

import type { Types } from 'mongoose';

export type ActivityAction =
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'VIEW'
  | 'EDIT_CONTENT'
  | 'RENAME'
  | 'MOVE'
  | 'FOLDER_CREATE'
  | 'TRASH'
  | 'RESTORE'
  | 'DELETE_PERMANENT'
  | 'SHARE'
  | 'PERMISSION_CHANGE'
  | 'UNSHARE'
  | 'USER_CREATE'
  | 'USER_STATUS_CHANGE'
  | 'QUOTA_CHANGE';

export interface ActivityLog {
  userId: Types.ObjectId;
  userEmail?: string | null;
  action: ActivityAction;
  status: 'success' | 'error';
  resourceType: string;
  resourceId: Types.ObjectId;
  resourceSnapshot: Record<string, unknown>;
  details: Record<string, unknown>;
  affectedUserIds: Types.ObjectId[];
  timestamp: Date;
}

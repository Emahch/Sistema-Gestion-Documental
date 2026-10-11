import { Schema, Types, model } from 'mongoose';
import type { ActivityLog } from '../types/activity-log';

const activityLogSchema = new Schema<ActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      enum: [
        'UPLOAD',
        'DOWNLOAD',
        'VIEW',
        'EDIT_CONTENT',
        'RENAME',
        'MOVE',
        'FOLDER_CREATE',
        'TRASH',
        'RESTORE',
        'DELETE_PERMANENT',
        'SHARE',
        'PERMISSION_CHANGE',
        'UNSHARE',
        'USER_CREATE',
        'USER_STATUS_CHANGE',
        'QUOTA_CHANGE',
      ],
      required: true,
    },
    status: { type: String, enum: ['success', 'error'], required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    resourceSnapshot: { type: Schema.Types.Mixed, default: {} },
    details: { type: Schema.Types.Mixed, default: {} },
    affectedUserIds: { type: [Schema.Types.ObjectId], default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'activity_logs', timestamps: false }
);

activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ action: 1, status: 1, timestamp: -1 });
activityLogSchema.index({ affectedUserIds: 1, timestamp: -1 });

export const ActivityLogModel = model<ActivityLog>('ActivityLog', activityLogSchema);


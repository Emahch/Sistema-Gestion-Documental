const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
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
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    resourceSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    affectedUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'activity_logs', timestamps: false }
);

activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ action: 1, status: 1, timestamp: -1 });
activityLogSchema.index({ affectedUserIds: 1, timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = { ActivityLog };

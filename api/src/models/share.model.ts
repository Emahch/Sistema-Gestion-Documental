import { Schema, Types, model } from 'mongoose';
import type { Share } from '../types/share';

const shareSchema = new Schema<Share>(
  {
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    sharedWithId: { type: Schema.Types.ObjectId, required: true },
    permission: { type: String, enum: ['read', 'edit'], required: true },
    origin: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shareSchema.index({ resourceId: 1, sharedWithId: 1 }, { unique: true });
shareSchema.index({ sharedWithId: 1, createdAt: -1 });
shareSchema.index({ ownerId: 1, origin: 1, createdAt: -1 });

export const ShareModel = model<Share>('Share', shareSchema);


import { Schema, Types, model } from 'mongoose';
import type { Folder } from '../types/folder';

const folderSchema = new Schema<Folder>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    isRoot: { type: Boolean, default: false },
    name: { type: String, required: true },
    nameNormalized: { type: String, required: true },
    ancestors: { type: [Schema.Types.ObjectId], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: undefined },
    deletionId: { type: Schema.Types.ObjectId, default: undefined },
    isDeletionRoot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

folderSchema.index({ parentId: 1, isDeleted: 1, nameNormalized: 1 });
folderSchema.index({ ancestors: 1, isDeleted: 1 });
folderSchema.index(
  { parentId: 1, nameNormalized: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, isRoot: false } }
);
folderSchema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { isRoot: true } });
folderSchema.index(
  { ownerId: 1, deletedAt: -1 },
  { partialFilterExpression: { isDeleted: true, isDeletionRoot: true } }
);
folderSchema.index({ deletionId: 1 }, { partialFilterExpression: { isDeleted: true } });

export const FolderModel = model<Folder>('Folder', folderSchema);


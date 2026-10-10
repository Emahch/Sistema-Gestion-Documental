const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRoot: { type: Boolean, default: false },
    name: { type: String, required: true },
    nameNormalized: { type: String, required: true },
    ancestors: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: undefined },
    deletionId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
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

const Folder = mongoose.model('Folder', folderSchema);

module.exports = { Folder };

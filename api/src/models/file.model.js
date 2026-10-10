const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    nameNormalized: { type: String, required: true },
    mimeType: { type: String, required: true },
    category: { type: String, enum: ['TXT', 'MD'], required: true },
    size: { type: Number, required: true },
    gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: undefined },
    deletionId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
    isDeletionRoot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fileSchema.index({ folderId: 1, isDeleted: 1, nameNormalized: 1 });
fileSchema.index(
  { folderId: 1, nameNormalized: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
fileSchema.index({ ownerId: 1, isDeleted: 1, category: 1, createdAt: -1 });
fileSchema.index({ ownerId: 1, isDeleted: 1, createdAt: -1 });
fileSchema.index({ ownerId: 1, isDeleted: 1, nameNormalized: 1 });
fileSchema.index({ isDeleted: 1, createdAt: -1 });
fileSchema.index(
  { ownerId: 1, deletedAt: -1 },
  { partialFilterExpression: { isDeleted: true, isDeletionRoot: true } }
);
fileSchema.index({ deletionId: 1 }, { partialFilterExpression: { isDeleted: true } });

const File = mongoose.model('File', fileSchema);

module.exports = { File };

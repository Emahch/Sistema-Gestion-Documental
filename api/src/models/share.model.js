const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    resourceType: { type: String, required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sharedWithId: { type: mongoose.Schema.Types.ObjectId, required: true },
    permission: { type: String, enum: ['read', 'edit'], required: true },
    origin: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shareSchema.index({ resourceId: 1, sharedWithId: 1 }, { unique: true });
shareSchema.index({ sharedWithId: 1, createdAt: -1 });
shareSchema.index({ ownerId: 1, origin: 1, createdAt: -1 });

const Share = mongoose.model('Share', shareSchema);

module.exports = { Share };

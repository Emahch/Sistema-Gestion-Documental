const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true },
    emailNormalized: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    storage: {
      quotaBytes: { type: Number, default: null },
      usedBytes: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.index({ emailNormalized: 1 }, { unique: true });
userSchema.index({ isActive: 1, role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = { User };

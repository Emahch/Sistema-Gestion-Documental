import { Schema, model } from 'mongoose';
import type { User } from '../types/user';

const userSchema = new Schema<User>(
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

export const UserModel = model<User>('User', userSchema);


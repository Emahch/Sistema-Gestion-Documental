import type { Types } from 'mongoose';

export interface Folder {
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
  parentId: Types.ObjectId | null;
  isRoot: boolean;
  name: string;
  nameNormalized: string;
  ancestors: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletionId?: Types.ObjectId;
  isDeletionRoot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicFolder {
  id: string;
  ownerId: string;
  parentId: string | null;
  isRoot: boolean;
  name: string;
  ancestors: string[];
  createdAt: Date;
  updatedAt: Date;
}

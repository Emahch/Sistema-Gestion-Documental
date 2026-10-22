import type { Types } from 'mongoose';

export type FileCategory = 'TXT' | 'MD';

export interface File {
  ownerId: Types.ObjectId;
  folderId: Types.ObjectId;
  name: string;
  nameNormalized: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  gridFsId: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletionId?: Types.ObjectId;
  isDeletionRoot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicFile {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  name: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

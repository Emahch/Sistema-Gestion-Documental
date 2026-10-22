export interface DriveFolder {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  createdBy?: string | null;
  parentId: string | null;
  isRoot: boolean;
  name: string;
  ancestors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  name: string;
  mimeType: string;
  category: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderChildren {
  folders: DriveFolder[];
  files: DriveFile[];
  page: number;
  limit: number;
  totalFolders: number;
  totalFiles: number;
}

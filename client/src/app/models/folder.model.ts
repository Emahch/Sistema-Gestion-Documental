export interface DriveFolder {
  id: string;
  ownerId: string;
  parentId: string | null;
  isRoot: boolean;
  name: string;
  ancestors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
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
}

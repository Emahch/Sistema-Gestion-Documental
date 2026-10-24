export interface ReportUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

export interface FilesByCategoryRow {
  category: 'TXT' | 'MD';
  count: number;
  sizeBytes: number;
}

export interface FilesByCategoryResult {
  data: FilesByCategoryRow[];
  totalFiles: number;
  totalBytes: number;
}

export interface FilesByDateRow {
  id: string;
  name: string;
  category: 'TXT' | 'MD';
  size: number;
  ownerId: string;
  ownerEmail: string | null;
  createdAt: string;
}

export interface FilesByDateResult {
  data: FilesByDateRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    count: number;
    totalBytes: number;
  };
}

export interface TopFileRow {
  fileId: string;
  name: string;
  operations: number;
  lastOperationAt: string;
  exists: boolean;
  isDeleted: boolean;
  category: 'TXT' | 'MD' | null;
  ownerEmail: string | null;
}

export interface TopUserByFilesRow {
  ownerId: string;
  email: string | null;
  isActive: boolean | null;
  role: 'admin' | 'user' | null;
  fileCount: number;
  totalBytes: number;
}

export interface TopUserBySharedRow {
  ownerId: string;
  email: string | null;
  sharedCount: number;
  manualCount: number;
  autoCount: number;
}

export interface TopSharedFileRow {
  fileId: string;
  name: string;
  sharedWithCount: number;
  ownerEmail: string | null;
  isDeleted: boolean;
  lastSharedAt: string;
}

export interface SharedByUserRow {
  resourceType: 'file' | 'folder';
  resourceId: string;
  name: string;
  isDeleted: boolean;
  recipientCount: number;
  origins: ('manual' | 'auto')[];
  lastSharedAt: string;
}

export interface SharedByUserResult {
  data: SharedByUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ReceivedByUserRow {
  resourceType: 'file' | 'folder';
  resourceId: string;
  name: string;
  isDeleted: boolean;
  ownerId: string;
  ownerEmail: string | null;
  permission: 'read' | 'edit';
  origin: 'manual' | 'auto';
  sharedAt: string;
}

export interface ReceivedByUserResult {
  data: ReceivedByUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface UserActivityRow {
  id: string;
  userEmail: string | null;
  action: string;
  resourceType: 'file' | 'folder';
  resourceId: string;
  resourceSnapshot: Record<string, unknown>;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface UserActivityResult {
  data: UserActivityRow[];
  total: number;
  page: number;
  limit: number;
  user: { id: string; email: string };
}

export interface OperationsByActionRow {
  action: string;
  count: number;
}

export interface OperationsByActionResult {
  data: OperationsByActionRow[];
  total: number;
}

export interface OperationsByPeriodRow {
  period: string;
  count: number;
}

export interface OperationsByPeriodResult {
  data: OperationsByPeriodRow[];
  total: number;
  granularity: 'day' | 'week' | 'month';
  timezone: string;
}

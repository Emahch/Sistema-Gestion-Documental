export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  storage: { quotaBytes: number | null; usedBytes: number };
  createdAt: string;
}

export interface PagedUsers {
  data: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: 'user' | 'admin';
  quotaBytes: number | null;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role?: 'user' | 'admin';
}

export interface StorageInfo {
  usedBytes: number;
  quotaBytes: number | null;
  available: number | null;
  reconciled?: { sumBytes: number; matches: boolean };
}

export type UserRole = 'admin' | 'user';

export interface User {
  email: string;
  emailNormalized: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  storage: {
    quotaBytes: number | null;
    usedBytes: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role?: UserRole;
  quotaBytes?: number | null;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  storage: User['storage'];
  createdAt: Date;
}

export interface ListUsersQuery {
  page?: unknown;
  limit?: unknown;
  q?: unknown;
  role?: unknown;
}

export interface PagedUsers {
  data: PublicUser[];
  total: number;
  page: number;
  limit: number;
}
export interface ActivityResourceItem {
  id: string;
  userId: string;
  userEmail: string | null;
  action: string;
  status: string;
  resourceType: 'file' | 'folder';
  resourceId: string;
  resourceSnapshot: Record<string, unknown>;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityAffectedItem {
  id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  resourceType: 'file' | 'folder';
  resourceId: string;
  resourceSnapshot: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityList<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

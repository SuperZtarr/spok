export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MOVE'
  | 'BULK_MOVE'
  | 'ADD_RELATION'
  | 'DELETE_RELATION';

export type AuditEntity = 'Item' | 'ItemRelation';

export interface AuditLogChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  spaceId: string;
  changes: AuditLogChanges | null;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface AuditLogFilters {
  entity?: AuditEntity;
  action?: AuditAction;
  entityId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MOVE'
  | 'BULK_MOVE'
  | 'ADD_RELATION'
  | 'UPDATE_RELATION'
  | 'DELETE_RELATION';

export type AuditEntity = 'Item' | 'ItemRelation' | 'Contribution' | 'Space' | 'Community';

export interface AuditLogChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  spaceId: string | null;
  batchId?: string | null;
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
  batchId?: string;
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

// Delete preview types
export interface SpaceDeletePreview {
  childSpaces: Array<{ id: string; name: string; itemCount: number }>;
  directItemCount: number;
  totalItemCount: number;
  totalContributionCount: number;
}

export interface CommunityDeletePreview {
  spaces: Array<{ id: string; name: string; itemCount: number }>;
  totalItemCount: number;
  totalMemberCount: number;
}

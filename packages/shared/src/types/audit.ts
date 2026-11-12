/* Types AuditLog : actions, entités, aperçu de suppression (delete preview).
 * Entité 'Tag' et action 'MERGE' (2026-11-11) : gestion des tags dans /admin/tags (routes/admin/tags.ts).
 * ItemHistory* (2026-11-12) : historique d'un élément lu par ses membres dans la fiche (règle item-history-members). */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MOVE'
  | 'BULK_MOVE'
  | 'ADD_RELATION'
  | 'UPDATE_RELATION'
  | 'DELETE_RELATION'
  | 'MERGE'
  | 'BACKUP';

export type AuditEntity = 'Item' | 'ItemRelation' | 'Contribution' | 'Space' | 'Community' | 'Tag' | 'System';

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

/** Historique d'un élément dans sa fiche (GET /spaces/:spaceId/items/:id/history, 2026-11-12) : lignes déjà
 *  libellées par l'API (utils/itemHistory.ts), jamais l'état brut du journal. label = ce qui a changé ; before /
 *  after = valeurs lisibles (absentes quand la ligne se suffit : « Description modifiée »). */
export interface ItemHistoryLine {
  label: string;
  before?: string | null;
  after?: string | null;
}

export interface ItemHistoryEntry {
  id: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  /** Écriture faite par le MCP (jeton personnel) */
  viaMcp: boolean;
  lines: ItemHistoryLine[];
}

export interface ItemHistoryResponse {
  entries: ItemHistoryEntry[];
  /** createdAt de la dernière entrée lue, à repasser en ?before= ; null = plus rien */
  nextCursor: string | null;
}

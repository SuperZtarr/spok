/*
 * Création des entrées AuditLog + sérialiseurs par entité (item, espace, communauté, relation).
 * Écriture issue du MCP distant : changes.source = { via: 'mcp', tokenId, tokenName } (cf. utils/requestContext.ts).
 * Accepte le client Prisma ou un client de transaction ($transaction interactive).
 * createAuditLogs : écriture groupée (createMany) — à préférer en boucle sur N items dans une transaction.
 * L'audit sert aussi de sauvegarde : serialize*ForAudit doit capturer tout ce que *RestoreData recrée.
 */
import type { PrismaClient, Prisma } from '@spok/database';
import type { AuditAction, AuditEntity } from '@spok/shared';
import { getRequestContext } from './requestContext.js';

type AuditDb = PrismaClient | Prisma.TransactionClient;

export interface AuditLogData {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  userId: string;
  spaceId: string | null;
  batchId?: string;
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

function toAuditRow(data: AuditLogData) {
  const ctx = getRequestContext();
  return {
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    spaceId: data.spaceId,
    batchId: data.batchId || null,
    userId: data.userId,
    changes: (ctx ? { ...data.changes, source: { via: ctx.via, tokenId: ctx.tokenId, tokenName: ctx.tokenName } } : data.changes) as any,
  };
}

export async function createAuditLog(
  prisma: AuditDb,
  data: AuditLogData
): Promise<void> {
  await prisma.auditLog.create({ data: toAuditRow(data) });
}

export async function createAuditLogs(
  prisma: AuditDb,
  data: AuditLogData[]
): Promise<void> {
  if (data.length === 0) return;
  await prisma.auditLog.createMany({ data: data.map(toAuditRow) });
}

/**
 * Serialize an item for audit logging
 * Extracts the relevant fields to store in changes
 */
export function serializeItemForAudit(item: Record<string, unknown>): Record<string, unknown> {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    status: item.status,
    priority: item.priority,
    position: item.position,
    dueDate: item.dueDate,
    startDate: item.startDate,
    endDate: item.endDate,
    parentId: item.parentId,
    manualHorizon: item.manualHorizon,
    horizonSetAt: item.horizonSetAt,
    spaceId: item.spaceId,
    createdById: item.createdById,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Serialize a relation for audit logging
 */
export function serializeRelationForAudit(relation: Record<string, unknown>): Record<string, unknown> {
  return {
    id: relation.id,
    fromItemId: relation.fromItemId,
    toItemId: relation.toItemId,
    type: relation.type,
  };
}

/**
 * Serialize a space for audit logging.
 * Tout champ nécessaire à la recréation (restauration depuis l'audit) doit figurer ici ET dans
 * spaceRestoreData — sinon il est perdu à la restauration.
 */
export function serializeSpaceForAudit(space: Record<string, unknown>): Record<string, unknown> {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    type: space.type,
    communityId: space.communityId,
    parentId: space.parentId,
    visibility: space.visibility,
    defaultRole: space.defaultRole,
    defaultView: space.defaultView,
    position: space.position,
    avatarUrl: space.avatarUrl,
    coverUrl: space.coverUrl,
    coverPosition: space.coverPosition,
    coverPositionX: space.coverPositionX,
    coverZoom: space.coverZoom,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}

/**
 * Serialize a community for audit logging.
 * Même règle que serializeSpaceForAudit : tenir communityRestoreData aligné.
 */
export function serializeCommunityForAudit(community: Record<string, unknown>): Record<string, unknown> {
  return {
    id: community.id,
    name: community.name,
    description: community.description,
    visibility: community.visibility,
    pendingVisibility: community.pendingVisibility,
    context: community.context,
    referentiels: community.referentiels,
    avatarUrl: community.avatarUrl,
    coverUrl: community.coverUrl,
    coverPosition: community.coverPosition,
    coverPositionX: community.coverPositionX,
    coverZoom: community.coverZoom,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  };
}

/** Valeur présente dans un état d'audit (absente des anciennes entrées → laisser le défaut du schéma). */
function present<T>(before: Record<string, unknown>, key: string): T | undefined {
  const value = before[key];
  return value === undefined || value === null ? undefined : (value as T);
}

/**
 * Visibilité d'une communauté à recréer. Les entrées d'audit antérieures au 2026-10-16 ne portent que
 * l'ancien booléen isPublic : true → OPEN, sinon PRIVATE.
 */
export function restoredCommunityVisibility(before: Record<string, unknown>): 'OPEN' | 'READONLY' | 'PRIVATE' {
  const visibility = before.visibility;
  if (visibility === 'OPEN' || visibility === 'READONLY' || visibility === 'PRIVATE') return visibility;
  return before.isPublic === true ? 'OPEN' : 'PRIVATE';
}

/**
 * Données de recréation d'une communauté depuis son état « before » d'audit — source unique des
 * restaurations unitaire et par lot (routes/admin/auditLogs.ts).
 */
export function communityRestoreData(before: Record<string, unknown>) {
  return {
    id: before.id as string,
    name: before.name as string,
    description: (before.description as string | null) ?? null,
    visibility: restoredCommunityVisibility(before),
    pendingVisibility: present<string>(before, 'pendingVisibility'),
    context: present<string>(before, 'context'),
    referentiels: present<object>(before, 'referentiels'),
    avatarUrl: (before.avatarUrl as string | null) ?? null,
    coverUrl: (before.coverUrl as string | null) ?? null,
    coverPosition: present<number>(before, 'coverPosition'),
    coverPositionX: present<number>(before, 'coverPositionX'),
    coverZoom: present<number>(before, 'coverZoom'),
  };
}

/**
 * Données de recréation d'un espace depuis son état « before » d'audit. communityId et parentId sont
 * fournis par l'appelant (déjà vérifiés : null si la cible n'existe plus).
 */
export function spaceRestoreData(
  before: Record<string, unknown>,
  links: { communityId: string | null; parentId: string | null },
) {
  return {
    id: before.id as string,
    name: before.name as string,
    description: (before.description as string | null) ?? null,
    type: before.type as string,
    communityId: links.communityId,
    parentId: links.parentId,
    visibility: present<string>(before, 'visibility'),
    defaultRole: present<string>(before, 'defaultRole'),
    defaultView: present<string>(before, 'defaultView'),
    position: present<number>(before, 'position'),
    avatarUrl: (before.avatarUrl as string | null) ?? null,
    coverUrl: (before.coverUrl as string | null) ?? null,
    coverPosition: present<number>(before, 'coverPosition'),
    coverPositionX: present<number>(before, 'coverPositionX'),
    coverZoom: present<number>(before, 'coverZoom'),
  };
}

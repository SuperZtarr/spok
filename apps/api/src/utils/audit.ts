/*
 * Création des entrées AuditLog + sérialiseurs par entité (item, espace, communauté, relation).
 * Écriture issue du MCP distant : changes.source = { via: 'mcp', tokenId, tokenName } (cf. utils/requestContext.ts).
 * Accepte le client Prisma ou un client de transaction ($transaction interactive).
 * createAuditLogs : écriture groupée (createMany) — à préférer en boucle sur N items dans une transaction.
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
 * Serialize a space for audit logging
 */
export function serializeSpaceForAudit(space: Record<string, unknown>): Record<string, unknown> {
  return {
    id: space.id,
    name: space.name,
    type: space.type,
    communityId: space.communityId,
    parentId: space.parentId,
    avatarUrl: space.avatarUrl,
    coverUrl: space.coverUrl,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}

/**
 * Serialize a community for audit logging
 */
export function serializeCommunityForAudit(community: Record<string, unknown>): Record<string, unknown> {
  return {
    id: community.id,
    name: community.name,
    description: community.description,
    isPublic: community.isPublic,
    avatarUrl: community.avatarUrl,
    coverUrl: community.coverUrl,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  };
}

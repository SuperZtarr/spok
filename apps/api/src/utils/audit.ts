import type { PrismaClient } from '@spok/database';
import type { AuditAction, AuditEntity } from '@spok/shared';

export interface AuditLogData {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  userId: string;
  spaceId: string;
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export async function createAuditLog(
  prisma: PrismaClient,
  data: AuditLogData
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      spaceId: data.spaceId,
      userId: data.userId,
      changes: data.changes as any,
    },
  });
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
    parentId: item.parentId,
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

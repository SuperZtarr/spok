/*
 * Suppression d'un espace (avec ou sans ses sous-espaces) et d'une communauté — source unique pour
 * DELETE /spaces/:id, /admin/spaces/:id, /communities/:id, /admin/communities/:id.
 *
 * - Les contrôles de droits restent dans les routes ; ici, uniquement l'écriture.
 * - À appeler DANS une transaction (runDeletion) : tout ou rien. Avant 2026-10-13, chaque route
 *   enchaînait les écritures sans transaction → une erreur en cours laissait items supprimés et
 *   sous-espaces restants (incident prod : audit écrit après la suppression de l'espace, FK).
 * - Ordre imposé : l'audit d'un espace est écrit AVANT sa suppression (audit_logs.spaceId est une FK,
 *   passée à null par SetNull à la suppression).
 * - Audits des items en un seul createMany (une transaction longue risque le délai d'expiration).
 */
import type { PrismaClient, Prisma } from '@spok/database';
import { createAuditLog, createAuditLogs, serializeItemForAudit, serializeSpaceForAudit, serializeCommunityForAudit } from './audit.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface DeletionContext {
  userId: string;
  batchId: string;
}

/** Délai des transactions de suppression (défaut Prisma : 5 s, trop court pour un gros espace). */
export const DELETION_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

/** Exécute une suppression en transaction interactive (tout ou rien). */
export function runDeletion<T>(prisma: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, DELETION_TX_OPTIONS);
}

/** Ids de tous les sous-espaces (profondeur quelconque), parents avant enfants. */
export async function collectDescendantSpaceIds(db: Db, rootId: string): Promise<string[]> {
  const ids: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db.space.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((c) => c.id).filter((id) => id !== rootId && !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

/** Supprime les items des espaces donnés (contributions, relations, items) et les audite. */
async function deleteItemsOfSpaces(db: Db, spaceIds: string[], ctx: DeletionContext): Promise<void> {
  const items = await db.item.findMany({ where: { spaceId: { in: spaceIds } } });
  if (items.length === 0) return;
  const itemIds = items.map((i) => i.id);
  await db.contribution.deleteMany({ where: { itemId: { in: itemIds } } });
  await db.itemRelation.deleteMany({ where: { OR: [{ fromItemId: { in: itemIds } }, { toItemId: { in: itemIds } }] } });
  await createAuditLogs(db, items.map((item) => ({
    action: 'DELETE' as const,
    entity: 'Item' as const,
    entityId: item.id,
    userId: ctx.userId,
    spaceId: item.spaceId,
    batchId: ctx.batchId,
    changes: { before: serializeItemForAudit(item as unknown as Record<string, unknown>) },
  })));
  await db.item.deleteMany({ where: { spaceId: { in: spaceIds } } });
}

/** Membres, audit puis suppression d'un espace (ses items doivent déjà être supprimés). */
async function deleteSpaceRow(db: Db, space: { id: string } & Record<string, unknown>, ctx: DeletionContext): Promise<void> {
  await db.spaceMembership.deleteMany({ where: { spaceId: space.id } });
  await createAuditLog(db, {
    action: 'DELETE',
    entity: 'Space',
    entityId: space.id,
    userId: ctx.userId,
    spaceId: space.id,
    batchId: ctx.batchId,
    changes: { before: serializeSpaceForAudit(space) },
  });
  await db.space.delete({ where: { id: space.id } });
}

/**
 * Supprime un espace. deleteChildren = true : tous les sous-espaces et leurs items ;
 * false : les enfants directs sont détachés (parentId null), seuls les items de l'espace partent.
 * Renvoie les ids des espaces supprimés.
 */
export async function deleteSpaceTree(
  db: Db,
  space: { id: string } & Record<string, unknown>,
  deleteChildren: boolean,
  ctx: DeletionContext,
): Promise<string[]> {
  const descendantIds = deleteChildren ? await collectDescendantSpaceIds(db, space.id) : [];

  if (deleteChildren) {
    await deleteItemsOfSpaces(db, [...descendantIds, space.id], ctx);
    // Feuilles d'abord (ordre inverse du parcours parents → enfants)
    for (const descendantId of [...descendantIds].reverse()) {
      const descendant = await db.space.findUnique({ where: { id: descendantId } });
      if (descendant) await deleteSpaceRow(db, descendant as unknown as { id: string } & Record<string, unknown>, ctx);
    }
  } else {
    await db.space.updateMany({ where: { parentId: space.id }, data: { parentId: null } });
    await deleteItemsOfSpaces(db, [space.id], ctx);
  }

  await deleteSpaceRow(db, space, ctx);
  return [...descendantIds, space.id];
}

/**
 * Supprime une communauté. deleteChildren = true : tous ses espaces (et sous-espaces) ;
 * false : ses espaces sont détachés (communityId null).
 */
export async function deleteCommunityTree(
  db: Db,
  community: { id: string } & Record<string, unknown>,
  deleteChildren: boolean,
  ctx: DeletionContext,
): Promise<void> {
  if (deleteChildren) {
    const spaces = await db.space.findMany({ where: { communityId: community.id } });
    const deleted = new Set<string>();
    // Un sous-espace de la communauté est supprimé avec son parent : on le saute ensuite
    for (const space of spaces) {
      if (deleted.has(space.id)) continue;
      const ids = await deleteSpaceTree(db, space as unknown as { id: string } & Record<string, unknown>, true, ctx);
      ids.forEach((id) => deleted.add(id));
    }
  } else {
    await db.space.updateMany({ where: { communityId: community.id }, data: { communityId: null } });
  }

  await db.communityMembership.deleteMany({ where: { communityId: community.id } });
  await createAuditLog(db, {
    action: 'DELETE',
    entity: 'Community',
    entityId: community.id,
    userId: ctx.userId,
    spaceId: null,
    batchId: ctx.batchId,
    changes: { before: serializeCommunityForAudit(community) },
  });
  await db.community.delete({ where: { id: community.id } });
}

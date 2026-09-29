/*
 * Accusé de lecture à l'assignation (décision Thomas 2026-09-29).
 * - assignmentStamp : champs à écrire sur l'item quand l'assigné change (date + auteur), à appeler sur
 *   TOUS les chemins qui modifient assignedToId (création, PATCH, fusion, restauration d'audit).
 * - computeAssignmentReceipts : pour une liste d'items, l'accusé de chacun — une seule requête ItemView.
 * Règles : « vu » = l'assigné a ouvert l'item (ItemView.viewedAt) après assignedAt ; pas d'indicateur
 * (null) si non assigné, auto-assigné, ou assignation antérieure à la fonctionnalité (assignedAt null).
 * Marquer l'item non lu ensuite ne retire pas l'accusé (viewedAt conservé).
 */
import type { PrismaClient } from '@spok/database';

/** Accusé exposé par l'API : null = pas d'indicateur ; seenAt null = pas encore vu. */
export type AssignmentReceipt = { seenAt: string | null } | null;

type AssignmentFields = { assignedAt?: Date | null; assignedById?: string | null };

/**
 * @param previous assigné actuel en base
 * @param next assigné demandé (undefined = champ absent de la requête)
 * @param actorId utilisateur qui fait la modification
 */
export function assignmentStamp(
  previous: string | null | undefined,
  next: string | null | undefined,
  actorId: string,
  now: Date = new Date(),
): AssignmentFields {
  if (next === undefined || (next ?? null) === (previous ?? null)) return {};
  if (!next) return { assignedAt: null, assignedById: null };
  return { assignedAt: now, assignedById: actorId };
}

interface ReceiptSource {
  id: string;
  assignedToId: string | null;
  assignedAt: Date | string | null;
  assignedById: string | null;
}

function needsReceipt(it: ReceiptSource): it is ReceiptSource & { assignedToId: string; assignedAt: Date | string } {
  return !!it.assignedToId && !!it.assignedAt && it.assignedById !== it.assignedToId;
}

export async function computeAssignmentReceipts(
  prisma: Pick<PrismaClient, 'itemView'>,
  items: ReceiptSource[],
): Promise<Map<string, AssignmentReceipt>> {
  const result = new Map<string, AssignmentReceipt>();
  const pending = items.filter(needsReceipt);
  const pendingIds = new Set(pending.map((i) => i.id));
  for (const it of items) if (!pendingIds.has(it.id)) result.set(it.id, null);
  if (pending.length === 0) return result;

  const views = await prisma.itemView.findMany({
    where: {
      itemId: { in: pending.map((i) => i.id) },
      userId: { in: [...new Set(pending.map((i) => i.assignedToId))] },
    },
    select: { userId: true, itemId: true, viewedAt: true },
  });
  const viewed = new Map(views.map((v) => [`${v.userId}:${v.itemId}`, v.viewedAt]));

  for (const it of pending) {
    const viewedAt = viewed.get(`${it.assignedToId}:${it.id}`);
    const seen = viewedAt && new Date(viewedAt) >= new Date(it.assignedAt);
    result.set(it.id, { seenAt: seen ? new Date(viewedAt).toISOString() : null });
  }
  return result;
}

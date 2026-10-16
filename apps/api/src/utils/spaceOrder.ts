/*
 * Ordre manuel des espaces (lot 4, 2026-10-16) — source unique pour GET/POST/PATCH /spaces et PUT /spaces/reorder.
 * - Un espace est ordonné parmi ses FRÈRES : même parent, ou, à la racine, même communauté (null = indépendants).
 * - Tri : position croissante, puis nom (fr). Tant que personne n'a réordonné (positions à 0), l'ordre reste
 *   alphabétique.
 * - Un espace créé ou déplacé arrive en dernier parmi ses nouveaux frères (nextSiblingPosition).
 * - reorderSiblings réécrit les positions de TOUS les frères : ceux listés dans l'ordre donné, puis les autres
 *   (non visibles par l'appelant, par ex. privés) dans leur ordre actuel — jamais de doublon de position.
 * Les droits sont contrôlés par la route, pas ici.
 */
import type { PrismaClient, Prisma } from '@spok/database';

type Db = PrismaClient | Prisma.TransactionClient;

/** orderBy Prisma des listes d'espaces */
export const SPACE_ORDER_BY = [{ position: 'asc' as const }, { name: 'asc' as const }];

/** Comparateur des listes fusionnées en mémoire (membre + non-membre) */
export function compareSpaceOrder(a: { position?: number | null; name: string }, b: { position?: number | null; name: string }): number {
  return (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, 'fr');
}

/** Filtre Prisma des frères d'un emplacement (parent, sinon racine de la communauté) */
export function siblingsWhere(parentId: string | null, communityId: string | null): Prisma.SpaceWhereInput {
  return parentId ? { parentId } : { parentId: null, communityId, type: 'GROUP' };
}

/** Position pour arriver en dernier parmi les frères */
export async function nextSiblingPosition(db: Db, parentId: string | null, communityId: string | null, excludeId?: string): Promise<number> {
  const last = await db.space.aggregate({
    where: { ...siblingsWhere(parentId, communityId), ...(excludeId ? { id: { not: excludeId } } : {}) },
    _max: { position: true },
  });
  return (last?._max?.position ?? -1) + 1;
}

/** Ordre final : ids demandés (filtrés sur les frères réels), puis les frères non cités dans leur ordre actuel */
export function mergeOrder(currentOrder: string[], requested: string[]): string[] {
  const known = new Set(currentOrder);
  const head = requested.filter((id, i) => known.has(id) && requested.indexOf(id) === i);
  const listed = new Set(head);
  return [...head, ...currentOrder.filter((id) => !listed.has(id))];
}

/** Réécrit les positions des frères ; renvoie l'ordre appliqué */
export async function reorderSiblings(db: Db, parentId: string | null, communityId: string | null, orderedIds: string[]): Promise<string[]> {
  const siblings = await db.space.findMany({ where: siblingsWhere(parentId, communityId), select: { id: true }, orderBy: SPACE_ORDER_BY });
  const finalOrder = mergeOrder(siblings.map((s) => s.id), orderedIds);
  for (const [position, id] of finalOrder.entries()) {
    await db.space.update({ where: { id }, data: { position } });
  }
  return finalOrder;
}

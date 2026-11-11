/*
 * Tags de classement posés par le système (lot 4 « contenus multiples », 2026-11-11) : une anomalie est une Tâche
 * taguée « bug », une configuration une Note taguée « config » (ces types n'existent plus).
 * ensureTag(prisma, spaceId, name) : tag de ce nom (sans casse) de la communauté de l'espace — ou de l'espace s'il n'a
 * pas de communauté —, créé s'il manque. Utilisé par les modèles d'espace (itemTree.ts) ; le script de migration
 * scripts/migrate-item-types.ts suit la même règle. Ne jamais créer un tag d'espace quand l'espace a une communauté :
 * les tags d'une communauté sont partagés par tous ses espaces.
 */
import type { PrismaClient } from '@spok/database';

/** Couleur d'un tag créé par le système (#rrggbb, comme la route tags) */
export const SYSTEM_TAG_COLORS: Record<string, string> = { bug: '#ef4444', config: '#6b7280' };

export async function ensureTag(prisma: PrismaClient, spaceId: string, name: string): Promise<string> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  const scope = space?.communityId ? { communityId: space.communityId } : { spaceId };
  const existing = await prisma.tag.findFirst({ where: { ...scope, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.tag.create({ data: { ...scope, name, color: SYSTEM_TAG_COLORS[name] ?? null }, select: { id: true } });
  return created.id;
}

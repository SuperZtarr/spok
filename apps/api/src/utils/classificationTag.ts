/*
 * Tags de classement posés par le système (lot 4 « contenus multiples », 2026-11-11) : une anomalie est une Tâche
 * taguée « bug », une configuration une Note taguée « config » (ces types n'existent plus).
 * ensureTag(prisma, spaceId, name) : tag de ce nom (sans casse) visible depuis l'espace — le global d'abord, puis celui
 * de la communauté de l'espace —, créé s'il manque : dans la communauté, ou en global si l'espace n'a pas de
 * communauté (tag système, pas une saisie d'utilisateur). Utilisé par les modèles d'espace (itemTree.ts) ; le script
 * scripts/migrate-item-types.ts suit la même règle. Jamais de tag d'espace (portée : utils/tagScope.ts).
 */
import type { PrismaClient } from '@spok/database';
import { findTagByName, spaceCommunityId } from './tagScope.js';

/** Couleur d'un tag créé par le système (#rrggbb, comme la route tags) */
export const SYSTEM_TAG_COLORS: Record<string, string> = { bug: '#ef4444', config: '#6b7280' };

export async function ensureTag(prisma: PrismaClient, spaceId: string, name: string): Promise<string> {
  const communityId = await spaceCommunityId(prisma, spaceId);
  const existing = await findTagByName(prisma, communityId, name);
  if (existing) return existing.id;
  const created = await prisma.tag.create({
    data: { communityId, name, color: SYSTEM_TAG_COLORS[name] ?? null },
    select: { id: true },
  });
  return created.id;
}

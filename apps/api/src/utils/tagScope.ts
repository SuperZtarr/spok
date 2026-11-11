/*
 * Portée des tags (décision Thomas 2026-11-11) : un tag appartient à une COMMUNAUTÉ (communityId) ou est GLOBAL
 * (ni communityId ni spaceId : proposé dans tous les espaces, géré par les admins dans /admin/tags). Plus de tag
 * d'espace : la colonne spaceId reste en base, inutilisée, jusqu'à la migration scripts/migrate-space-tags.ts.
 * - GLOBAL_TAG_WHERE : filtre Prisma des tags globaux.
 * - tagsVisibleWhere(communityId) : tags utilisables dans un espace de cette communauté (communauté + globaux) ;
 *   espace sans communauté (communityId null) : globaux seulement.
 * - findTagByName(prisma, communityId, name) : tag de ce nom (sans casse) visible depuis la communauté, global d'abord.
 * - mapTagsToSpace(prisma, tags, targetSpaceId) : tags d'éléments qui changent d'espace (déplacement, conversion,
 *   copie de séance) → ids visibles dans l'espace cible : global ou même communauté gardé ; sinon tag de même nom
 *   (global, puis communauté cible, créé dans la communauté cible s'il manque) ; cible sans communauté → abandonné.
 *   tagMapping : même règle en table id source → id cible (duplication, déplacement).
 * Ne jamais créer de tag avec spaceId.
 */
import type { PrismaClient, Prisma } from '@spok/database';

type Db = PrismaClient | Prisma.TransactionClient;

export const GLOBAL_TAG_WHERE = { communityId: null, spaceId: null } as const;

export function tagsVisibleWhere(communityId: string | null | undefined): Prisma.TagWhereInput {
  return communityId ? { OR: [{ communityId }, GLOBAL_TAG_WHERE] } : GLOBAL_TAG_WHERE;
}

export function isGlobalTag(tag: { communityId: string | null; spaceId?: string | null }): boolean {
  return !tag.communityId && !tag.spaceId;
}

export async function spaceCommunityId(prisma: Db, spaceId: string): Promise<string | null> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  return space?.communityId ?? null;
}

/** Tag de ce nom (sans casse) visible depuis la communauté : le global d'abord, puis celui de la communauté */
export async function findTagByName(prisma: Db, communityId: string | null, name: string) {
  const found = await prisma.tag.findMany({
    where: { ...tagsVisibleWhere(communityId), name: { equals: name.trim(), mode: 'insensitive' } },
    select: { id: true, name: true, color: true, communityId: true, spaceId: true },
  });
  return found.find(isGlobalTag) ?? found[0] ?? null;
}

export interface TagToMap { id: string; name: string; color: string | null; communityId: string | null; spaceId: string | null }

export async function mapTagsToSpace(prisma: Db, tags: TagToMap[], targetSpaceId: string): Promise<string[]> {
  const targetCommunityId = await spaceCommunityId(prisma, targetSpaceId);
  const ids = new Set<string>();
  for (const tag of tags) {
    if (isGlobalTag(tag) || (targetCommunityId && tag.communityId === targetCommunityId)) {
      ids.add(tag.id);
      continue;
    }
    const existing = await findTagByName(prisma, targetCommunityId, tag.name);
    if (existing) { ids.add(existing.id); continue; }
    if (!targetCommunityId) continue; // espace sans communauté : globaux seulement
    const created = await prisma.tag.create({
      data: { name: tag.name, color: tag.color, communityId: targetCommunityId },
      select: { id: true },
    });
    ids.add(created.id);
  }
  return [...ids];
}

/** Même règle que mapTagsToSpace, rendue en table id source → id cible (tag abandonné : absent de la table) */
export async function tagMapping(prisma: Db, tags: TagToMap[], targetSpaceId: string): Promise<Map<string, string>> {
  const unique = [...new Map(tags.map((t) => [t.id, t])).values()];
  const map = new Map<string, string>();
  for (const tag of unique) {
    const [id] = await mapTagsToSpace(prisma, [tag], targetSpaceId);
    if (id) map.set(tag.id, id);
  }
  return map;
}

/*
 * Portée des tags. Trois portées (décision Thomas 2026-11-11, tags d'espace rétablis le 2026-11-12) :
 * - GLOBAL (ni communityId ni spaceId) : proposé dans tous les espaces, géré par les admins dans /admin/tags ;
 * - COMMUNAUTÉ (communityId) : proposé dans tous les espaces de la communauté ;
 * - ESPACE (spaceId) : proposé dans cet espace ET tous ses descendants (héritage). Un tag a l'une OU l'autre colonne.
 * Tags visibles depuis un espace = globaux + sa communauté + ses tags et ceux de ses ancêtres (règle tag-scope de
 * apps/web/src/lib/businessRules.ts). Même nom visible plusieurs fois : global d'abord, puis communauté, puis l'espace
 * le plus proche.
 * - spaceTagScope(prisma, spaceId) : { communityId, spaceIds } (spaceIds : l'espace puis ses ancêtres, du plus proche).
 * - tagsVisibleWhere(scope) : filtre Prisma des tags visibles ; isTagVisible(tag, scope) : même règle en mémoire.
 * - tagScopeKind(tag) : 'global' | 'community' | 'space' ; communityScope(id) : portée d'une communauté sans espace.
 * - spaceWithDescendantIds(prisma, spaceId) : l'espace et ses descendants (là où un tag d'espace est visible).
 * - findTagByName(prisma, scope, name) : tag de ce nom (sans casse) visible depuis la portée, selon la priorité.
 * - invisibleTagIds(prisma, spaceId, tagIds) : ids inconnus ou non visibles depuis l'espace (routes d'écriture : 400).
 * - mapTagsToSpace(prisma, tags, targetSpaceId) : tags d'éléments qui changent d'espace (déplacement, conversion,
 *   copie de séance) → ids visibles dans l'espace cible : gardé s'il y reste visible ; sinon tag visible de même nom ;
 *   sinon recréé comme tag de l'espace cible. tagMapping : même règle en table id source → id cible.
 * - remapOutOfScopeItemTags(prisma, spaceIds) : remplace, sur les éléments de ces espaces, chaque tag devenu invisible
 *   (espace déplacé, changement de communauté, données anciennes) — PATCH /spaces/:id et scripts/repair-tag-scope.ts.
 */
import type { PrismaClient, Prisma } from '@spok/database';

type Db = PrismaClient | Prisma.TransactionClient;

export interface TagScope {
  communityId: string | null;
  /** L'espace puis ses ancêtres, du plus proche au plus lointain */
  spaceIds: string[];
}

type ScopedTag = { communityId: string | null; spaceId?: string | null };

export const GLOBAL_TAG_WHERE = { communityId: null, spaceId: null } as const;

/** Portée d'une communauté sans espace (tags de communauté et globaux) */
export const communityScope = (communityId: string | null): TagScope => ({ communityId, spaceIds: [] });

export function tagsVisibleWhere(scope: TagScope): Prisma.TagWhereInput {
  const or: Prisma.TagWhereInput[] = [GLOBAL_TAG_WHERE];
  if (scope.communityId) or.push({ communityId: scope.communityId });
  if (scope.spaceIds.length > 0) or.push({ spaceId: { in: scope.spaceIds } });
  return or.length === 1 ? GLOBAL_TAG_WHERE : { OR: or };
}

export function isGlobalTag(tag: ScopedTag): boolean {
  return !tag.communityId && !tag.spaceId;
}

export function tagScopeKind(tag: ScopedTag): 'global' | 'community' | 'space' {
  return tag.spaceId ? 'space' : tag.communityId ? 'community' : 'global';
}

export function isTagVisible(tag: ScopedTag, scope: TagScope): boolean {
  if (tag.spaceId) return scope.spaceIds.includes(tag.spaceId);
  if (tag.communityId) return tag.communityId === scope.communityId;
  return true;
}

export async function spaceCommunityId(prisma: Db, spaceId: string): Promise<string | null> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  return space?.communityId ?? null;
}

export async function spaceTagScope(prisma: Db, spaceId: string): Promise<TagScope> {
  const spaceIds: string[] = [];
  let communityId: string | null = null;
  let current: string | null = spaceId;
  while (current && !spaceIds.includes(current) && spaceIds.length < 50) {
    const space: { parentId: string | null; communityId: string | null } | null = await prisma.space.findUnique({
      where: { id: current },
      select: { parentId: true, communityId: true },
    });
    if (!space) break;
    if (spaceIds.length === 0) communityId = space.communityId ?? null;
    spaceIds.push(current);
    current = space.parentId;
  }
  return { communityId, spaceIds };
}

/** L'espace et tous ses descendants (portée d'un tag d'espace vue d'en haut) */
export async function spaceWithDescendantIds(prisma: Db, spaceId: string): Promise<string[]> {
  const ids = [spaceId];
  for (let i = 0; i < ids.length; i++) {
    const children = await prisma.space.findMany({ where: { parentId: ids[i] }, select: { id: true } });
    for (const c of children) if (!ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}

/** Rang de priorité d'un tag visible : global 0, communauté 1, espace 2 + distance */
function rank(tag: ScopedTag, scope: TagScope): number {
  if (tag.spaceId) return 2 + scope.spaceIds.indexOf(tag.spaceId);
  return tag.communityId ? 1 : 0;
}

/** Tag de ce nom (sans casse) visible depuis la portée : global, puis communauté, puis espace le plus proche */
export async function findTagByName(prisma: Db, scope: TagScope, name: string) {
  const found = await prisma.tag.findMany({
    where: { ...tagsVisibleWhere(scope), name: { equals: name.trim(), mode: 'insensitive' } },
    select: { id: true, name: true, color: true, communityId: true, spaceId: true },
  });
  return [...found].sort((a, b) => rank(a, scope) - rank(b, scope))[0] ?? null;
}

/** Ids (dédoublonnés) inconnus ou non visibles depuis l'espace */
export async function invisibleTagIds(prisma: Db, spaceId: string, tagIds: string[]): Promise<string[]> {
  const ids = [...new Set(tagIds)];
  if (ids.length === 0) return [];
  const scope = await spaceTagScope(prisma, spaceId);
  const visible = await prisma.tag.findMany({ where: { id: { in: ids }, ...tagsVisibleWhere(scope) }, select: { id: true } });
  const ok = new Set(visible.map((t) => t.id));
  return ids.filter((id) => !ok.has(id));
}

export interface TagToMap { id: string; name: string; color: string | null; communityId: string | null; spaceId: string | null }

export async function mapTagsToSpace(prisma: Db, tags: TagToMap[], targetSpaceId: string): Promise<string[]> {
  const scope = await spaceTagScope(prisma, targetSpaceId);
  const ids = new Set<string>();
  for (const tag of tags) {
    if (isTagVisible(tag, scope)) { ids.add(tag.id); continue; }
    const existing = await findTagByName(prisma, scope, tag.name);
    if (existing) { ids.add(existing.id); continue; }
    const created = await prisma.tag.create({
      data: { name: tag.name, color: tag.color, spaceId: targetSpaceId },
      select: { id: true },
    });
    ids.add(created.id);
  }
  return [...ids];
}

/** Même règle que mapTagsToSpace, rendue en table id source → id cible */
export async function tagMapping(prisma: Db, tags: TagToMap[], targetSpaceId: string): Promise<Map<string, string>> {
  const unique = [...new Map(tags.map((t) => [t.id, t])).values()];
  const map = new Map<string, string>();
  for (const tag of unique) {
    const [id] = await mapTagsToSpace(prisma, [tag], targetSpaceId);
    if (id) map.set(tag.id, id);
  }
  return map;
}

export interface RemappedTag { itemId: string; spaceId: string; fromId: string; fromName: string; toId: string }

/**
 * Tags devenus invisibles sur les éléments de ces espaces → remplacés (règle de mapTagsToSpace).
 * apply=false : bilan seulement (rien d'écrit, toId '' quand le tag serait créé).
 */
export async function remapOutOfScopeItemTags(prisma: Db, spaceIds: string[], apply = true): Promise<RemappedTag[]> {
  const done: RemappedTag[] = [];
  for (const spaceId of spaceIds) {
    const scope = await spaceTagScope(prisma, spaceId);
    const links = await prisma.itemTag.findMany({
      where: { item: { spaceId }, NOT: [{ tag: tagsVisibleWhere(scope) }] },
      select: { itemId: true, tag: { select: { id: true, name: true, color: true, communityId: true, spaceId: true } } },
    });
    for (const link of links) {
      let toId = '';
      if (apply) {
        [toId] = await mapTagsToSpace(prisma, [link.tag], spaceId);
        await prisma.itemTag.deleteMany({ where: { itemId: link.itemId, tagId: link.tag.id } });
        await prisma.itemTag.createMany({ data: [{ itemId: link.itemId, tagId: toId }], skipDuplicates: true });
      } else {
        toId = (await findTagByName(prisma, scope, link.tag.name))?.id ?? '';
      }
      done.push({ itemId: link.itemId, spaceId, fromId: link.tag.id, fromName: link.tag.name, toId });
    }
  }
  return done;
}

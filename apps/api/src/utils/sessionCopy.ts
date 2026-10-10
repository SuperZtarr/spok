/*
 * Copie d'un item affiché en séance vers l'espace de séance, verrouillée (lockedAt), avec trace d'origine
 * (sourceItemId/sourceSpaceId), tags recréés par nom dans l'espace de séance, images R2 dupliquées (une copie
 * ne partage jamais un fichier de la source). Les sous-items ne sont PAS copiés à l'affichage (« ne pas
 * spoiler ») : revealChildInSession les copie un par un sous la copie parente. Réaffichage / re-révélation :
 * si la source n'a pas changé depuis la dernière copie, on la réutilise. Un item déjà dans l'espace de séance
 * est réaffiché tel quel. Une nouvelle copie se range sous la copie de son parent d'origine s'il a déjà été
 * présenté. L'appelant a déjà vérifié que l'utilisateur a accès à l'espace source.
 * cloneSessionCopies : recopie les copies verrouillées d'une séance vers sa « suite ».
 */
import { isR2Configured, isR2Url, copyR2Object } from './r2.js';

export class SessionCopyError extends Error {
  constructor(public code: 'NOT_FOUND', message: string) { super(message); }
}

interface CopyParams { sourceItemId: string; sourceSpaceId: string; sessionSpaceId: string; userId: string }

const IMG_SRC = /<img[^>]+src="([^"]+)"/g;
const TAGS_INCLUDE = { tags: { include: { tag: true } } } as const;

async function copyImages(item: { url: string | null; description: string | null }, newItemId: string) {
  if (!isR2Configured()) return { url: item.url, description: item.description };
  const url = isR2Url(item.url) ? await copyR2Object(item.url, newItemId) : item.url;
  let description = item.description;
  if (description) {
    const sources = [...description.matchAll(IMG_SRC)].map((m) => m[1]).filter((s) => isR2Url(s));
    for (const src of new Set(sources)) {
      description = description.split(src).join(await copyR2Object(src, newItemId));
    }
  }
  return { url, description };
}

async function sessionTagIds(prisma: any, sessionSpaceId: string, tags: Array<{ tag: { name: string; color: string | null } }>) {
  const ids: string[] = [];
  for (const { tag } of tags) {
    const existing = await prisma.tag.findFirst({ where: { spaceId: sessionSpaceId, name: { equals: tag.name, mode: 'insensitive' } } });
    ids.push(existing ? existing.id : (await prisma.tag.create({ data: { name: tag.name, color: tag.color, spaceId: sessionSpaceId } })).id);
  }
  return ids;
}

async function createLockedCopy(prisma: any, src: any, params: CopyParams, parentId: string | null, lockedAt: Date) {
  const created = await prisma.item.create({
    data: {
      type: src.type, title: src.title, description: src.description, content: src.content ?? undefined,
      url: src.url, status: src.status, priority: src.priority, position: src.position,
      dueDate: src.dueDate, startDate: src.startDate, endDate: src.endDate,
      spaceId: params.sessionSpaceId, createdById: params.userId, parentId,
      lockedAt, sourceItemId: src.id, sourceSpaceId: src.spaceId ?? params.sourceSpaceId,
    },
  });
  const images = await copyImages(src, created.id);
  const tagIds = await sessionTagIds(prisma, params.sessionSpaceId, src.tags ?? []);
  if (tagIds.length > 0) await prisma.itemTag.createMany({ data: tagIds.map((tagId) => ({ itemId: created.id, tagId })) });
  if (tagIds.length === 0 && images.url === src.url && images.description === src.description) return { ...created, tags: [] };
  return prisma.item.update({ where: { id: created.id }, data: images, include: TAGS_INCLUDE });
}

const flattenTags = (item: any) => ({ ...item, tags: (item.tags ?? []).map((t: any) => t.tag ?? t) });

export async function copyItemToSession(prisma: any, params: CopyParams) {
  const source = await prisma.item.findFirst({
    where: { id: params.sourceItemId, spaceId: params.sourceSpaceId },
    include: TAGS_INCLUDE,
  });
  if (!source) throw new SessionCopyError('NOT_FOUND', 'Élément source introuvable');

  // Élément déjà dans l'espace de séance (copie) : on le réaffiche tel quel
  if (params.sourceSpaceId === params.sessionSpaceId) {
    const children = await prisma.item.findMany({ where: { parentId: source.id }, include: TAGS_INCLUDE, orderBy: { position: 'asc' } });
    return { item: flattenTags(source), children: children.map(flattenTags), reused: true };
  }

  const previous = await prisma.item.findFirst({
    where: { spaceId: params.sessionSpaceId, sourceItemId: source.id },
    orderBy: { lockedAt: 'desc' },
    include: TAGS_INCLUDE,
  });
  if (previous?.lockedAt && source.updatedAt <= previous.lockedAt) {
    const children = await prisma.item.findMany({ where: { parentId: previous.id }, include: TAGS_INCLUDE, orderBy: { position: 'asc' } });
    return { item: flattenTags(previous), children: children.map(flattenTags), reused: true };
  }

  // Nouvelle copie : sans sous-items (révélés ensuite un par un). Rangée par défaut sous la copie de son
  // parent d'origine si celui-ci a déjà été présenté dans la séance (demande Thomas 2026-10-10).
  const parentCopy = source.parentId
    ? await prisma.item.findFirst({ where: { spaceId: params.sessionSpaceId, sourceItemId: source.parentId }, orderBy: { lockedAt: 'desc' }, select: { id: true } })
    : null;
  const copy = await createLockedCopy(prisma, source, params, parentCopy?.id ?? null, new Date());
  return { item: flattenTags(copy), children: [], reused: false };
}

interface RevealParams { parentCopyId: string; sourceChildId: string; sourceSpaceId: string; sessionSpaceId: string; userId: string }

/** Révèle un sous-item : copie verrouillée sous la copie parente (réutilisée si l'enfant source est inchangé). */
export async function revealChildInSession(prisma: any, params: RevealParams) {
  const child = await prisma.item.findFirst({
    where: { id: params.sourceChildId, spaceId: params.sourceSpaceId },
    include: TAGS_INCLUDE,
  });
  if (!child) throw new SessionCopyError('NOT_FOUND', 'Sous-élément source introuvable');
  const previous = await prisma.item.findFirst({
    where: { parentId: params.parentCopyId, sourceItemId: child.id },
    orderBy: { lockedAt: 'desc' },
    include: TAGS_INCLUDE,
  });
  if (previous?.lockedAt && child.updatedAt <= previous.lockedAt) return flattenTags(previous);
  const copy = await createLockedCopy(prisma, child, {
    sourceItemId: child.id, sourceSpaceId: params.sourceSpaceId, sessionSpaceId: params.sessionSpaceId, userId: params.userId,
  }, params.parentCopyId, new Date());
  return flattenTags(copy);
}

interface CloneParams { fromSpaceId: string; toSpaceId: string }

/**
 * Séance « suite » : recopie dans le nouvel espace toutes les copies verrouillées de la séance précédente
 * (date de présentation lockedAt, origine et auteur conservés ; images et tags dupliqués). La hiérarchie est
 * conservée entre copies ; une copie rangée sous un item d'organisation (non verrouillé, non repris) passe à la
 * racine. Les items d'organisation et les commentaires restent dans l'ancienne séance. Retourne le nombre recopié.
 */
export async function cloneSessionCopies(prisma: any, params: CloneParams): Promise<number> {
  const copies = await prisma.item.findMany({
    where: { spaceId: params.fromSpaceId, lockedAt: { not: null } },
    include: TAGS_INCLUDE,
    orderBy: { position: 'asc' },
  });
  const ids = new Set(copies.map((c: any) => c.id));
  const oldToNew = new Map<string, string>();
  let pending = [...copies];
  while (pending.length > 0) {
    // Parents d'abord : une copie est prête si son parent n'est pas une copie, ou est déjà recopié
    const ready = pending.filter((c: any) => !c.parentId || !ids.has(c.parentId) || oldToNew.has(c.parentId));
    if (ready.length === 0) break; // cycle impossible en pratique : garde-fou
    for (const c of ready) {
      const created = await prisma.item.create({
        data: {
          type: c.type, title: c.title, description: c.description, content: c.content ?? undefined,
          url: c.url, status: c.status, priority: c.priority, position: c.position,
          dueDate: c.dueDate, startDate: c.startDate, endDate: c.endDate,
          spaceId: params.toSpaceId, createdById: c.createdById,
          parentId: c.parentId ? oldToNew.get(c.parentId) ?? null : null,
          lockedAt: c.lockedAt, sourceItemId: c.sourceItemId, sourceSpaceId: c.sourceSpaceId,
        },
      });
      oldToNew.set(c.id, created.id);
      const images = await copyImages(c, created.id);
      const tagIds = await sessionTagIds(prisma, params.toSpaceId, c.tags ?? []);
      if (tagIds.length > 0) await prisma.itemTag.createMany({ data: tagIds.map((tagId) => ({ itemId: created.id, tagId })) });
      if (images.url !== c.url || images.description !== c.description) {
        await prisma.item.update({ where: { id: created.id }, data: images });
      }
    }
    pending = pending.filter((c: any) => !oldToNew.has(c.id));
  }
  return oldToNew.size;
}

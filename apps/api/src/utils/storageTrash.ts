/*
 * Corbeille du stockage des éléments (décision Thomas 2026-11-26, règle de gestion storage-trash).
 * Raison d'être : un fichier d'élément (clé items/…) que plus rien n'utilise ne reste ni orphelin ni public. Il part à la
 * corbeille (r2.ts moveToTrash : adresse coupée aussitôt), une ligne storage_trash le suit, et il est effacé après
 * STORAGE_TRASH_GRACE_DAYS jours (@spok/shared storageTrash.ts, seule source du délai et des motifs).
 *
 * « Utilisé » = référencé par un contenu (url ou aperçu), l'ancienne colonne items.url, une description d'élément ou une
 * contribution (images insérées). Les sauvegardes de l'historique ne comptent pas : c'est ce que la corbeille préserve.
 *
 * - trashUnusedFiles(prisma, groups) : à appeler APRÈS la suppression (élément, espace, fusion, retrait d'un contenu),
 *   hors transaction. Ne lève jamais : une panne du stockage ne doit pas faire échouer la suppression (journalisée).
 * - itemFileUrls(...) : adresses des fichiers d'éléments portés par des éléments et leurs contenus (candidats).
 * - restoreTrashedFiles(prisma, urls) : remet en place les fichiers d'un élément restauré ; renvoie les adresses perdues
 *   (effacées définitivement) pour que la restauration ne recrée pas de contenu mort.
 * - purgeExpiredTrash / purgeTrashEntries : effacement définitif (échus : surveillance de l'API ; choisis : admin).
 * - measureStorage, findOrphans, trashOrphans : rubrique Stockage de la page Volumétrie (routes/admin/volumetry.ts).
 * Ne jamais effacer un fichier d'élément directement (deleteFileFromR2) : passer par ce module. Exception : les aperçus
 * techniques régénérés (aperçu PNG d'un schéma redessiné, image d'aperçu d'un lien actualisée), effacés tout de suite.
 */
import {
  STORAGE_TRASH_GRACE_DAYS, STORAGE_ORPHAN_MIN_AGE_HOURS, VOLUMETRY_STORAGE_MAX_MB, storageLevel,
  type StorageTrashReason, type StorageReport, type StorageTrashEntry, type StorageOrphan,
} from '@spok/shared';
import {
  isR2Configured, storageKeyFromUrl, storageUrlForKey, isItemFileKey, moveToTrash, restoreFromTrash, deleteStorageKey,
  storageObjectExists, listStorageObjects, ITEM_FILES_PREFIX, TRASH_PREFIX,
} from './r2.js';

/** Fichiers libérés par une opération, avec ce qui sera noté dans la corbeille */
export interface ReleasedFiles {
  urls: (string | null | undefined)[];
  reason: StorageTrashReason;
  itemId?: string | null;
  itemTitle?: string | null;
  spaceId?: string | null;
}

type Logger = { warn?: (o: unknown, msg: string) => void } | undefined;

const DAY_MS = 24 * 3600_000;
const toMB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

/** Clés de fichiers d'éléments citées dans un texte (images insérées dans une description ou une contribution). */
export function storageKeysInText(text: string | null | undefined): string[] {
  if (!text) return [];
  const base = storageUrlForKey(ITEM_FILES_PREFIX);
  const keys: string[] = [];
  let i = text.indexOf(base);
  while (i !== -1) {
    const rest = text.slice(i + base.length);
    const end = rest.search(/["'\s)<>?#]/);
    const key = ITEM_FILES_PREFIX + (end === -1 ? rest : rest.slice(0, end));
    if (isItemFileKey(key) && key.length > ITEM_FILES_PREFIX.length) keys.push(key);
    i = text.indexOf(base, i + base.length);
  }
  return keys;
}

/** Adresses des fichiers portés par des éléments (ancienne colonne url, images de description) et leurs contenus. */
export function itemFileUrls(
  items: { url?: string | null; description?: string | null }[],
  contents: { url?: string | null; previewUrl?: string | null }[],
): string[] {
  const urls: string[] = [];
  for (const it of items) {
    if (it.url) urls.push(it.url);
    for (const k of storageKeysInText(it.description)) urls.push(storageUrlForKey(k));
  }
  for (const c of contents) {
    if (c.url) urls.push(c.url);
    if (c.previewUrl) urls.push(c.previewUrl);
  }
  return urls;
}

/** Le fichier est-il encore utilisé quelque part ? (contenus, items.url, descriptions, contributions) */
export async function isFileKeyInUse(prisma: any, key: string): Promise<boolean> {
  const [contents, items, contributions] = await Promise.all([
    prisma.itemContent.count({ where: { OR: [{ url: { contains: key } }, { previewUrl: { contains: key } }] } }),
    prisma.item.count({ where: { OR: [{ url: { contains: key } }, { description: { contains: key } }] } }),
    prisma.contribution.count({ where: { content: { contains: key } } }),
  ]);
  return contents + items + contributions > 0;
}

/** Met à la corbeille une clé non utilisée ; renvoie vrai si le fichier y est entré. */
async function trashKey(prisma: any, key: string, info: Omit<ReleasedFiles, 'urls'>): Promise<boolean> {
  if (await isFileKeyInUse(prisma, key)) return false;
  const moved = await moveToTrash(key);
  if (!moved) return false;
  const now = new Date();
  await prisma.storageTrash.create({
    data: {
      key, trashKey: moved.trashKey, size: moved.size, reason: info.reason,
      itemId: info.itemId ?? null, itemTitle: info.itemTitle ?? null, spaceId: info.spaceId ?? null,
      trashedAt: now, purgeAfter: new Date(now.getTime() + STORAGE_TRASH_GRACE_DAYS * DAY_MS),
    },
  });
  return true;
}

/** Met à la corbeille les fichiers libérés que plus rien n'utilise. Ne lève jamais ; renvoie le nombre mis à la corbeille. */
export async function trashUnusedFiles(prisma: any, groups: ReleasedFiles[], log?: Logger): Promise<number> {
  let trashed = 0;
  try {
    if (!isR2Configured()) return 0;
    const seen = new Set<string>();
    for (const g of groups) {
      for (const url of g.urls) {
        const key = storageKeyFromUrl(url);
        if (!isItemFileKey(key) || seen.has(key)) continue;
        seen.add(key);
        try {
          if (await trashKey(prisma, key, g)) trashed++;
        } catch (err) {
          log?.warn?.({ err, key }, 'mise à la corbeille du stockage impossible');
        }
      }
    }
  } catch (err) {
    log?.warn?.({ err }, 'corbeille du stockage indisponible');
  }
  return trashed;
}

/**
 * Remet en place les fichiers d'un élément restauré. Renvoie les adresses perdues : fichier d'élément ni présent ni dans
 * la corbeille (effacé définitivement). Adresses externes et fichiers présents : rien à faire.
 */
export async function restoreTrashedFiles(prisma: any, urls: (string | null | undefined)[]): Promise<Set<string>> {
  const lost = new Set<string>();
  try {
    if (!isR2Configured()) return lost;
    for (const url of new Set(urls)) {
      const key = storageKeyFromUrl(url);
      if (!url || !isItemFileKey(key)) continue;
      if (await storageObjectExists(key)) continue;
      const entry = await prisma.storageTrash.findFirst({ where: { key }, orderBy: { trashedAt: 'desc' } });
      if (!entry) { lost.add(url); continue; }
      try {
        await restoreFromTrash(entry.trashKey, key);
        await prisma.storageTrash.delete({ where: { id: entry.id } });
      } catch {
        lost.add(url);
      }
    }
  } catch {
    // Stockage indisponible : la restauration continue et recrée les contenus tels quels (rien n'est déclaré perdu)
  }
  return lost;
}

/** Efface définitivement des entrées de la corbeille (fichier puis ligne). Renvoie le nombre effacé. */
async function purgeEntries(prisma: any, entries: { id: string; trashKey: string }[], log?: Logger): Promise<number> {
  let purged = 0;
  for (const e of entries) {
    try {
      await deleteStorageKey(e.trashKey);
      await prisma.storageTrash.delete({ where: { id: e.id } });
      purged++;
    } catch (err) {
      log?.warn?.({ err, key: e.trashKey }, 'effacement de la corbeille du stockage impossible');
    }
  }
  return purged;
}

/** Efface les fichiers dont le délai de grâce est passé (surveillance de l'API). */
export async function purgeExpiredTrash(prisma: any, log?: Logger, now = new Date()): Promise<number> {
  if (!isR2Configured()) return 0;
  const due = await prisma.storageTrash.findMany({ where: { purgeAfter: { lte: now } }, select: { id: true, trashKey: true } });
  return purgeEntries(prisma, due, log);
}

/** « Effacer maintenant » (admin) : entrées choisies de la corbeille. */
export async function purgeTrashEntries(prisma: any, ids: string[]): Promise<number> {
  const entries = await prisma.storageTrash.findMany({ where: { id: { in: ids } }, select: { id: true, trashKey: true } });
  return purgeEntries(prisma, entries);
}

const fileName = (key: string) => key.split('/').pop() ?? key;
/** items/<id>/… → id de l'élément d'origine */
const itemIdOfKey = (key: string) => key.split('/')[1] || null;

/** Volume des fichiers d'éléments actifs et de la corbeille, face au seuil. */
export async function measureStorage(now = new Date()): Promise<StorageReport> {
  const [active, trash] = isR2Configured()
    ? await Promise.all([listStorageObjects(ITEM_FILES_PREFIX), listStorageObjects(TRASH_PREFIX)])
    : [[], []];
  const vol = (objs: { size: number }[]) => ({ count: objs.length, sizeMB: toMB(objs.reduce((s, o) => s + o.size, 0)) });
  const a = vol(active);
  const t = vol(trash);
  return {
    measuredAt: now.toISOString(), active: a, trash: t, maxMB: VOLUMETRY_STORAGE_MAX_MB,
    level: storageLevel(a.sizeMB + t.sizeMB), graceDays: STORAGE_TRASH_GRACE_DAYS,
  };
}

/** Corbeille : entrées les plus anciennes d'abord, avec le nom de l'espace d'origine s'il existe encore. */
export async function listTrash(prisma: any): Promise<StorageTrashEntry[]> {
  const rows = await prisma.storageTrash.findMany({ orderBy: { trashedAt: 'asc' } });
  const spaceIds = [...new Set(rows.map((r: any) => r.spaceId).filter(Boolean))] as string[];
  const spaces = spaceIds.length
    ? await prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true, name: true } }) : [];
  const spaceName = new Map<string, string>(spaces.map((s: any) => [s.id, s.name]));
  return rows.map((r: any) => ({
    id: r.id, key: r.key, name: fileName(r.key), size: r.size ?? null, reason: r.reason,
    itemId: r.itemId ?? null, itemTitle: r.itemTitle ?? null, spaceId: r.spaceId ?? null,
    spaceName: r.spaceId ? spaceName.get(r.spaceId) ?? null : null,
    trashedAt: new Date(r.trashedAt).toISOString(), purgeAfter: new Date(r.purgeAfter).toISOString(),
  }));
}

/** Toutes les clés de fichiers d'éléments encore utilisées (inventaire, en une lecture par table). */
async function referencedKeys(prisma: any): Promise<Set<string>> {
  const base = storageUrlForKey(ITEM_FILES_PREFIX);
  const [contents, items, contributions] = await Promise.all([
    prisma.itemContent.findMany({
      where: { OR: [{ url: { contains: ITEM_FILES_PREFIX } }, { previewUrl: { contains: ITEM_FILES_PREFIX } }] },
      select: { url: true, previewUrl: true },
    }),
    prisma.item.findMany({
      where: { OR: [{ url: { contains: ITEM_FILES_PREFIX } }, { description: { contains: base } }] },
      select: { url: true, description: true },
    }),
    prisma.contribution.findMany({ where: { content: { contains: base } }, select: { content: true } }),
  ]);
  const keys = new Set<string>();
  const add = (u: string | null | undefined) => { const k = storageKeyFromUrl(u); if (k) keys.add(k); };
  for (const c of contents) { add(c.url); add(c.previewUrl); }
  for (const it of items) { add(it.url); storageKeysInText(it.description).forEach((k) => keys.add(k)); }
  for (const c of contributions) storageKeysInText(c.content).forEach((k) => keys.add(k));
  return keys;
}

/** Fichiers d'éléments présents dans le stockage que plus rien n'utilise (hors corbeille, hors envois récents). */
export async function findOrphans(prisma: any, now = new Date()): Promise<StorageOrphan[]> {
  if (!isR2Configured()) return [];
  const [objects, used] = await Promise.all([listStorageObjects(ITEM_FILES_PREFIX), referencedKeys(prisma)]);
  const minAge = now.getTime() - STORAGE_ORPHAN_MIN_AGE_HOURS * 3600_000;
  const orphans = objects.filter((o) => isItemFileKey(o.key) && !used.has(o.key)
    && (!o.lastModified || o.lastModified.getTime() < minAge));
  const itemIds = [...new Set(orphans.map((o) => itemIdOfKey(o.key)).filter(Boolean))] as string[];
  const items = itemIds.length
    ? await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, title: true } }) : [];
  const title = new Map<string, string>(items.map((i: any) => [i.id, i.title]));
  return orphans.map((o) => {
    const itemId = itemIdOfKey(o.key);
    return {
      key: o.key, name: fileName(o.key), size: o.size, lastModified: o.lastModified ? o.lastModified.toISOString() : null,
      itemId, itemTitle: itemId ? title.get(itemId) ?? null : null,
    };
  });
}

/** « Mettre à la corbeille » (admin) : orphelins choisis, chacun re-contrôlé avant d'être déplacé. */
export async function trashOrphans(prisma: any, keys: string[], log?: Logger): Promise<number> {
  let trashed = 0;
  for (const key of new Set(keys)) {
    if (!isItemFileKey(key)) continue;
    try {
      if (await trashKey(prisma, key, { reason: 'ORPHAN_SWEEP', itemId: itemIdOfKey(key) })) trashed++;
    } catch (err) {
      log?.warn?.({ err, key }, 'mise à la corbeille du stockage impossible');
    }
  }
  return trashed;
}

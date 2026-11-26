/*
 * Recopie des contenus d'un élément (images, fichiers, liens, schémas) vers un autre élément — lot 4 « contenus
 * multiples » (2026-11-11) : remplace la recopie de l'ancien champ Item.url dans la duplication (item-bulk.ts) et la
 * copie de séance (sessionCopy.ts). Ordre, sorte, nom, type, taille et xml gardés ; auteur = celui qui copie.
 * copyFiles : true = chaque fichier du stockage est dupliqué sous items/<nouvel id>/ (copie de séance : une copie ne
 * partage jamais le fichier de la source) ; false = la copie pointe le même fichier (duplication, comme avant —
 * l'effacement d'un contenu n'efface un fichier que s'il n'est plus utilisé, item-contents.ts).
 * Le lot 5 (copier/coller, fusion, déplacement) réutilise ce module.
 * Aperçu d'un fichier (previewUrl, excerpt — 2026-11-11) : recopié comme l'adresse, image dupliquée si copyFiles.
 * Coordonnées (value, 2026-11-25) : recopiées, sauvegardées et restaurées comme le reste.
 */
import { isR2Configured, isR2Url, copyR2Object } from './r2.js';
import { itemFileUrls, restoreTrashedFiles } from './storageTrash.js';

export async function copyItemContents(
  prisma: any, fromItemId: string, toItemId: string, opts: { userId: string; copyFiles: boolean },
): Promise<number> {
  const contents = await prisma.itemContent.findMany({ where: { itemId: fromItemId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  const copyOf = async (u: string | null) =>
    (opts.copyFiles && u && isR2Configured() && isR2Url(u) ? copyR2Object(u, toItemId) : u);
  for (const c of contents) {
    const url = await copyOf(c.url);
    const previewUrl = await copyOf(c.previewUrl ?? null);
    await prisma.itemContent.create({
      data: {
        itemId: toItemId, kind: c.kind, url, name: c.name, mimeType: c.mimeType, size: c.size, xml: c.xml,
        previewUrl, excerpt: c.excerpt ?? null, value: c.value ?? null, position: c.position, createdById: opts.userId,
      },
    });
  }
  return contents.length;
}

/*
 * Sauvegarde des contenus dans l'audit d'une suppression (2026-11-21, bug cmwqmg75f00co7icccb0lgguw) : la suppression
 * d'un élément est définitive (cascade sur item_contents) et sa restauration repart de l'état « before » de l'audit.
 * snapshotItemContents lit les contenus de plusieurs éléments (par élément) ; restoreItemContents les recrée avec leur
 * id. Auteur disparu → null. Fichiers (2026-11-26) : à la suppression, ils partent à la corbeille du stockage
 * (utils/storageTrash.ts, 60 jours) ; restoreDeletedItemFiles les remet à leur adresse d'origine avant la recréation,
 * et un fichier effacé définitivement n'est pas recréé (contenu mort).
 */
const CONTENT_BACKUP_KEYS = ['id', 'kind', 'url', 'name', 'mimeType', 'size', 'xml', 'previewUrl', 'excerpt', 'value', 'position', 'createdById', 'createdAt'] as const;

export async function snapshotItemContents(prisma: any, itemIds: string[]): Promise<Map<string, Record<string, unknown>[]>> {
  const byItem = new Map<string, Record<string, unknown>[]>();
  if (itemIds.length === 0) return byItem;
  const rows = await prisma.itemContent.findMany({ where: { itemId: { in: itemIds } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  for (const r of rows) {
    const backup = Object.fromEntries(CONTENT_BACKUP_KEYS.map((k) => [k, r[k] ?? null]));
    byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), backup]);
  }
  return byItem;
}

/**
 * Fichiers d'un élément supprimé (état « before » de l'audit : contenus, ancienne colonne url, images de la description)
 * remis en place depuis la corbeille du stockage (2026-11-26). Renvoie les adresses perdues (effacées définitivement),
 * à passer à restoreItemContents pour ne pas recréer de contenu mort. À appeler AVANT restoreItemContents.
 */
export async function restoreDeletedItemFiles(prisma: any, before: Record<string, unknown>): Promise<Set<string>> {
  const contents = Array.isArray(before.contents) ? before.contents as { url?: string | null; previewUrl?: string | null }[] : [];
  const item = { url: (before.url as string | null) ?? null, description: (before.description as string | null) ?? null };
  return restoreTrashedFiles(prisma, itemFileUrls([item], contents));
}

/**
 * Recrée les contenus sauvegardés. `lost` (restoreDeletedItemFiles) : image ou fichier dont le fichier est perdu → non
 * recréé ; aperçu perdu → contenu recréé sans aperçu (schéma, fichier, lien).
 */
export async function restoreItemContents(prisma: any, itemId: string, backups: unknown, lost: Set<string> = new Set()): Promise<number> {
  if (!Array.isArray(backups) || backups.length === 0) return 0;
  const authors = [...new Set(backups.map((b: any) => b?.createdById).filter((v): v is string => typeof v === 'string'))];
  const existing = new Set<string>(authors.length
    ? (await prisma.user.findMany({ where: { id: { in: authors } }, select: { id: true } })).map((u: any) => u.id) : []);
  const data = backups
    .filter((b: any) => b && typeof b.id === 'string' && typeof b.kind === 'string')
    .filter((b: any) => !((b.kind === 'IMAGE' || b.kind === 'FILE') && b.url && lost.has(b.url)))
    .map((b: any) => ({
      id: b.id, itemId, kind: b.kind, url: b.url && lost.has(b.url) ? null : b.url ?? null, name: b.name ?? null, mimeType: b.mimeType ?? null,
      size: b.size ?? null, xml: b.xml ?? null, previewUrl: b.previewUrl && lost.has(b.previewUrl) ? null : b.previewUrl ?? null,
      excerpt: b.excerpt ?? null, value: b.value ?? null,
      position: typeof b.position === 'number' ? b.position : 0,
      createdById: existing.has(b.createdById) ? b.createdById : null,
    }));
  if (data.length) await prisma.itemContent.createMany({ data, skipDuplicates: true });
  return data.length;
}

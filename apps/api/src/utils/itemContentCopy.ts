/*
 * Recopie des contenus d'un élément (images, fichiers, liens, schémas) vers un autre élément — lot 4 « contenus
 * multiples » (2026-11-11) : remplace la recopie de l'ancien champ Item.url dans la duplication (item-bulk.ts) et la
 * copie de séance (sessionCopy.ts). Ordre, sorte, nom, type, taille et xml gardés ; auteur = celui qui copie.
 * copyFiles : true = chaque fichier du stockage est dupliqué sous items/<nouvel id>/ (copie de séance : une copie ne
 * partage jamais le fichier de la source) ; false = la copie pointe le même fichier (duplication, comme avant —
 * l'effacement d'un contenu n'efface un fichier que s'il n'est plus utilisé, item-contents.ts).
 * Le lot 5 (copier/coller, fusion, déplacement) réutilise ce module.
 * Aperçu d'un fichier (previewUrl, excerpt — 2026-11-11) : recopié comme l'adresse, image dupliquée si copyFiles.
 */
import { isR2Configured, isR2Url, copyR2Object } from './r2.js';

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
        previewUrl, excerpt: c.excerpt ?? null, position: c.position, createdById: opts.userId,
      },
    });
  }
  return contents.length;
}

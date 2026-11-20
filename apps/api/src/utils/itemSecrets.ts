/*
 * Données sécurisées qui suivent un élément (2026-11-20) — seul module, avec routes/item-secrets.ts, autorisé à lire
 * la table item_secrets (garde : secrets-leak.test.ts).
 * - copyItemSecrets : duplication d'un élément (item-bulk.ts). Valeur déchiffrée puis re-chiffrée avec le nouvel id
 *   (AAD), auteur gardé ; visibilité gardée dans le même espace, « moi seul » sinon (les membres de l'espace d'arrivée
 *   ne reçoivent rien). Clé absente ou donnée illisible → donnée non recopiée, la duplication n'échoue jamais.
 *   Jamais appelée par la copie de séance (sessionCopy.ts) : une séance se présente à des tiers.
 * - moveItemSecrets : fusion / absorption (item-merge.ts, même espace) — rattache les données à l'élément gardé
 *   avant la suppression des éléments réunis. L'AAD est l'id de la donnée : inchangée, rien à re-chiffrer.
 * - privatizeItemSecrets : déplacement vers un autre espace (item-move.ts) — « membres de l'espace » → « moi seul ».
 */
import { randomUUID } from 'node:crypto';
import { isSecretsConfigured, encryptSecret, decryptSecret } from './secretCrypto.js';

export async function copyItemSecrets(
  prisma: any, fromItemId: string, toItemId: string, opts: { sameSpace: boolean },
): Promise<number> {
  if (!isSecretsConfigured()) return 0;
  const rows = await prisma.itemSecret.findMany({ where: { itemId: fromItemId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  let copied = 0;
  for (const s of rows) {
    let value: string; let login: string | null;
    try {
      value = decryptSecret(s.valueEnc, s.id);
      login = s.loginEnc ? decryptSecret(s.loginEnc, s.id) : null;
    } catch { continue; }
    const id = randomUUID();
    await prisma.itemSecret.create({
      data: {
        id, itemId: toItemId, label: s.label,
        loginEnc: login ? encryptSecret(login, id) : null,
        valueEnc: encryptSecret(value, id),
        visibility: opts.sameSpace ? s.visibility : 'PRIVATE',
        position: s.position, createdById: s.createdById,
      },
      select: { id: true },
    });
    copied++;
  }
  return copied;
}

export async function moveItemSecrets(prisma: any, fromItemIds: string[], toItemId: string): Promise<void> {
  if (fromItemIds.length === 0) return;
  await prisma.itemSecret.updateMany({ where: { itemId: { in: fromItemIds } }, data: { itemId: toItemId } });
}

export async function privatizeItemSecrets(prisma: any, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  await prisma.itemSecret.updateMany({ where: { itemId: { in: itemIds }, visibility: 'SPACE' }, data: { visibility: 'PRIVATE' } });
}

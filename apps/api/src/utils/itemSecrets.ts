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

/*
 * Sauvegarde dans l'audit d'une suppression et restauration (2026-11-21, bug cmwqmg75f00co7icccb0lgguw).
 * La sauvegarde garde le CHIFFRÉ avec l'id d'origine (AAD) : recréée avec le même id, la donnée se déchiffre ; jamais
 * de valeur en clair. Auteur disparu → donnée non recréée (elle n'avait de sens que pour lui).
 * redactAuditChanges : à appliquer à TOUTE entrée d'audit renvoyée par l'API (routes/auditLogs.ts, admin/auditLogs.ts) —
 * chiffrés retirés (remplacés par un nombre), et pour un lecteur non admin, libellés des données sécurisées retirés.
 */
const SECRET_BACKUP_SELECT = {
  id: true, itemId: true, label: true, loginEnc: true, valueEnc: true, keyVersion: true, visibility: true, position: true,
  createdById: true, revealCount: true, lastRevealedAt: true, createdAt: true,
} as const;

export async function snapshotItemSecrets(prisma: any, itemIds: string[]): Promise<Map<string, Record<string, unknown>[]>> {
  const byItem = new Map<string, Record<string, unknown>[]>();
  if (itemIds.length === 0) return byItem;
  const rows = await prisma.itemSecret.findMany({ where: { itemId: { in: itemIds } }, select: SECRET_BACKUP_SELECT });
  for (const { itemId, ...r } of rows) byItem.set(itemId, [...(byItem.get(itemId) ?? []), r]);
  return byItem;
}

export async function restoreItemSecrets(prisma: any, itemId: string, backups: unknown): Promise<number> {
  if (!Array.isArray(backups) || backups.length === 0) return 0;
  const valid = backups.filter((b: any) => b && typeof b.id === 'string' && typeof b.valueEnc === 'string' && typeof b.createdById === 'string');
  if (valid.length === 0) return 0;
  const authors = [...new Set(valid.map((b: any) => b.createdById as string))];
  const existing = new Set<string>((await prisma.user.findMany({ where: { id: { in: authors } }, select: { id: true } })).map((u: any) => u.id));
  const data = valid.filter((b: any) => existing.has(b.createdById)).map((b: any) => ({
    id: b.id, itemId, label: String(b.label ?? ''), loginEnc: b.loginEnc ?? null, valueEnc: b.valueEnc,
    keyVersion: typeof b.keyVersion === 'number' ? b.keyVersion : 1,
    visibility: b.visibility === 'SPACE' ? 'SPACE' : 'PRIVATE',
    position: typeof b.position === 'number' ? b.position : 0, createdById: b.createdById,
    revealCount: typeof b.revealCount === 'number' ? b.revealCount : 0,
    lastRevealedAt: b.lastRevealedAt ? new Date(b.lastRevealedAt) : null,
  }));
  if (data.length) await prisma.itemSecret.createMany({ data, skipDuplicates: true });
  return data.length;
}

export function redactAuditChanges(changes: unknown, opts: { keepLabels: boolean }): unknown {
  if (!changes || typeof changes !== 'object') return changes;
  const out: Record<string, any> = { ...(changes as Record<string, any>) };
  for (const side of ['before', 'after'] as const) {
    const s = out[side];
    if (!s || typeof s !== 'object') continue;
    const copy: Record<string, any> = { ...s };
    if (Array.isArray(copy.secrets)) {
      copy.secrets = opts.keepLabels ? copy.secrets.map((b: any) => ({ id: b?.id, label: b?.label })) : copy.secrets.length;
    }
    if (copy.contentChange?.kind === 'SECRET' && !opts.keepLabels) {
      const { name: _n, previousName: _p, ...rest } = copy.contentChange;
      copy.contentChange = rest;
    }
    if (copy.secretRead && !opts.keepLabels) {
      const { label: _l, ...rest } = copy.secretRead;
      copy.secretRead = rest;
    }
    out[side] = copy;
  }
  return out;
}

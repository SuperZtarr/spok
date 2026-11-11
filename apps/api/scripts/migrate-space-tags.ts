/**
 * Migration des tags d'espace (décision Thomas 2026-11-11 : plus que des tags de communauté et des tags globaux,
 * portée dans src/utils/tagScope.ts).
 * Pour chaque tag d'espace (spaceId renseigné) :
 *   - espace d'une communauté C : s'il existe un tag de même nom (sans casse) global ou de C — le global d'abord —,
 *     ses éléments reçoivent ce tag (sans double) et le tag d'espace est supprimé ; sinon le tag devient un tag de C
 *     (les tags d'espace suivants de même nom dans C s'y fondent).
 *   - espace sans communauté : un tag global de même nom reprend ses éléments ; sinon le tag est LAISSÉ tel quel et
 *     listé — à traiter dans /admin/tags (rendre global, fusionner ou supprimer), décision d'admin.
 * La colonne tags.spaceId reste en base (inutilisée).
 *
 * Sauvegarde : chaque --apply écrit backups/migrate-space-tags-<env>-<date>.json (racine du dépôt, ignoré par git).
 * --restore <fichier> : tags convertis rendus à leur espace, tags fondus recréés (même id) avec leurs éléments, liens
 * ajoutés aux tags gardés retirés.
 *
 * Exécuter : npx tsx apps/api/scripts/migrate-space-tags.ts [--prod] [--apply] [--restore <fichier>]
 * Sans --apply : bilan seulement. --prod : base de prod, sur demande explicite de Thomas seulement.
 * Rejouable : ne traite que les tags d'espace restants.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { prodPrisma, localPrisma, isProd } from './_env';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const restoreFile = restoreIdx > 0 ? process.argv[restoreIdx + 1] : undefined;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

type Backup = {
  env: string; at: string;
  converted: { id: string; spaceId: string; communityId: string }[];
  merged: { id: string; name: string; color: string | null; spaceId: string; targetId: string; itemIds: string[]; addedItemIds: string[] }[];
};

const keyOf = (scope: string, name: string) => `${scope}|${name.trim().toLowerCase()}`;

async function migrate() {
  const env = isProd ? 'PROD' : 'local';
  const spaceTags = await prisma.tag.findMany({
    where: { spaceId: { not: null } },
    include: { space: { select: { name: true, communityId: true } }, items: { select: { itemId: true } } },
    // Ordre stable : parmi des tags d'espace de même nom d'une communauté, le plus ancien (id) devient le tag gardé
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  // Tags gardés par portée+nom (global : scope 'G') — mis à jour au fil de la migration (simulation sans --apply)
  const kept = new Map<string, string>();
  for (const t of await prisma.tag.findMany({ where: { spaceId: null }, select: { id: true, name: true, communityId: true } })) {
    const k = keyOf(t.communityId ?? 'G', t.name);
    if (!kept.has(k)) kept.set(k, t.id);
  }

  const backup: Backup = { env, at: new Date().toISOString(), converted: [], merged: [] };
  const left: string[] = [];
  let mergedLinks = 0;

  for (const tag of spaceTags) {
    const communityId = tag.space?.communityId ?? null;
    const itemIds = tag.items.map((i) => i.itemId);
    const targetId = kept.get(keyOf('G', tag.name)) ?? (communityId ? kept.get(keyOf(communityId, tag.name)) : undefined);

    if (targetId) {
      const already = new Set((await prisma.itemTag.findMany({ where: { tagId: targetId, itemId: { in: itemIds } }, select: { itemId: true } })).map((l) => l.itemId));
      const addedItemIds = itemIds.filter((id) => !already.has(id));
      mergedLinks += addedItemIds.length;
      backup.merged.push({ id: tag.id, name: tag.name, color: tag.color, spaceId: tag.spaceId!, targetId, itemIds, addedItemIds });
      if (apply) {
        await prisma.$transaction([
          prisma.itemTag.createMany({ data: addedItemIds.map((itemId) => ({ itemId, tagId: targetId })), skipDuplicates: true }),
          prisma.tag.delete({ where: { id: tag.id } }),
        ]);
      }
      continue;
    }

    if (!communityId) {
      left.push(`${tag.name} [${tag.id}] — espace « ${tag.space?.name ?? tag.spaceId} » sans communauté, ${itemIds.length} élément(s)`);
      continue;
    }

    backup.converted.push({ id: tag.id, spaceId: tag.spaceId!, communityId });
    kept.set(keyOf(communityId, tag.name), tag.id);
    if (apply) await prisma.tag.update({ where: { id: tag.id }, data: { spaceId: null, communityId } });
  }

  console.log(`[${env}] ${apply ? 'MIGRATION' : 'BILAN (sans --apply, rien n\'est écrit)'}`);
  console.log(`  Tags d'espace : ${spaceTags.length}`);
  console.log(`  → devenus tags de communauté : ${backup.converted.length}`);
  console.log(`  → fondus dans un tag existant (global ou communauté) : ${backup.merged.length} (${mergedLinks} lien(s) ajouté(s))`);
  console.log(`  → laissés (espace sans communauté, à traiter dans /admin/tags) : ${left.length}`);
  for (const l of left) console.log(`     - ${l}`);
  if (!apply) return;

  const dir = path.join(ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `migrate-space-tags-${env}-${backup.at.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  const remaining = await prisma.tag.count({ where: { spaceId: { not: null } } });
  console.log(`Tags d'espace restants : ${remaining}`);
  console.log(`Sauvegarde : ${file}`);
}

async function restore(file: string) {
  const b: Backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`[${isProd ? 'PROD' : 'local'}] RESTAURATION de ${file} (sauvegarde ${b.env} du ${b.at})`);
  for (const c of b.converted) await prisma.tag.update({ where: { id: c.id }, data: { spaceId: c.spaceId, communityId: null } });
  for (const m of b.merged) {
    await prisma.tag.create({ data: { id: m.id, name: m.name, color: m.color, spaceId: m.spaceId } });
    await prisma.itemTag.createMany({ data: m.itemIds.map((itemId) => ({ itemId, tagId: m.id })), skipDuplicates: true });
    await prisma.itemTag.deleteMany({ where: { tagId: m.targetId, itemId: { in: m.addedItemIds } } });
  }
  console.log(`Restauré : ${b.converted.length} tags rendus à leur espace, ${b.merged.length} tags recréés.`);
}

(restoreFile ? restore(restoreFile) : migrate()).finally(() => prisma.$disconnect());

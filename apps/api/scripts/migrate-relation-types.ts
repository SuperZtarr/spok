/*
 * Conversion des relations hors RELATION_TYPES (décision Thomas 2026-09-28, option B) :
 * - depends / depends_on A→B (« A dépend de B ») → blocks B→A (même ordre qu'avant dans le chemin critique
 *   du Gantt). depends_on : 13 relations en prod au 2026-09-28, créées via le MCP (sa description suggérait
 *   DEPENDS_ON) — même sens que depends
 * - tests / duplicates → relates (même sens)
 * - tout autre type hors liste : signalé, jamais modifié
 * Collision avec l'unicité (fromItemId, toItemId, type) : la relation cible existante est conservée
 * (on lui reporte le commentaire si elle n'en a pas) et l'ancienne est supprimée.
 * Usage (depuis apps/api) :
 *   npx tsx scripts/migrate-relation-types.ts              → base locale, à blanc (comptes + détail)
 *   npx tsx scripts/migrate-relation-types.ts --apply      → base locale, écrit
 *   npx tsx scripts/migrate-relation-types.ts --prod       → prod, à blanc (lecture seule)
 *   npx tsx scripts/migrate-relation-types.ts --prod --apply → prod, écrit — UNIQUEMENT sur accord explicite de Thomas
 */
import { prodPrisma, localPrisma } from './_env';

const OFFICIAL = new Set(['blocks', 'relates', 'implements', 'parent', 'drives']);
const TO_RELATES = new Set(['tests', 'duplicates']);
const DEPENDS = new Set(['depends', 'depends_on']);

const target = process.argv.includes('--prod') ? 'PROD' : 'LOCAL';
const apply = process.argv.includes('--apply');
const p = target === 'PROD' ? prodPrisma() : localPrisma();

async function main() {
  console.log(`=== Relations hors liste — ${target} — ${apply ? 'ÉCRITURE' : 'À BLANC'} ===`);
  const legacy = await p.itemRelation.findMany({
    where: { type: { notIn: [...OFFICIAL] } },
    include: { fromItem: { select: { title: true } }, toItem: { select: { title: true } } },
    orderBy: { type: 'asc' },
  });

  const counts: Record<string, number> = {};
  for (const r of legacy) counts[r.type] = (counts[r.type] ?? 0) + 1;
  console.log('Répartition :', Object.keys(counts).length ? counts : 'aucune relation hors liste');

  let converted = 0, merged = 0, untouched = 0;
  for (const r of legacy) {
    let next: { fromItemId: string; toItemId: string; type: string } | null = null;
    if (DEPENDS.has(r.type)) next = { fromItemId: r.toItemId, toItemId: r.fromItemId, type: 'blocks' };
    else if (TO_RELATES.has(r.type)) next = { fromItemId: r.fromItemId, toItemId: r.toItemId, type: 'relates' };

    const desc = `[${r.type}] « ${r.fromItem.title} » → « ${r.toItem.title} »`;
    if (!next) { untouched++; console.log(`  inchangée (type inconnu) ${desc}`); continue; }

    const existing = await p.itemRelation.findUnique({
      where: { fromItemId_toItemId_type: next },
    });
    const nextDesc = next.type === 'blocks' ? `blocks « ${r.toItem.title} » → « ${r.fromItem.title} »` : `relates (même sens)`;

    if (existing) {
      merged++;
      console.log(`  fusion  ${desc} → ${nextDesc} existe déjà : ancienne supprimée${r.label && !existing.label ? ', commentaire reporté' : ''}`);
      if (apply) {
        if (r.label && !existing.label) await p.itemRelation.update({ where: { id: existing.id }, data: { label: r.label } });
        await p.itemRelation.delete({ where: { id: r.id } });
      }
    } else {
      converted++;
      console.log(`  convertie ${desc} → ${nextDesc}`);
      if (apply) await p.itemRelation.update({ where: { id: r.id }, data: next });
    }
  }

  console.log(`Bilan : ${converted} convertie(s), ${merged} fusionnée(s), ${untouched} laissée(s) telle(s) quelle(s)${apply ? '' : ' — rien écrit (à blanc)'}`);
}

main().catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; }).finally(() => p.$disconnect());

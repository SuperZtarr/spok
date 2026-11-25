/*
 * Restauration du statut des Périodes (décision Thomas 2026-11-25, option A : les Périodes retrouvent les statuts
 * ordinaires). Le 2026-11-20, migrate-type-statuses.ts avait vidé le statut de 37 périodes en prod, sauvegardé dans
 * backups/manual-prod-period-statuses-2026-11-20T12-29-03-337Z.json ([{ id, status }]).
 * Remet le statut sauvegardé UNIQUEMENT si l'élément est toujours une Période sans statut (jamais d'écrasement d'un
 * statut posé depuis) ; tout autre cas est signalé (supprimé, type changé, statut déjà posé).
 * Usage (depuis apps/api) :
 *   npx tsx scripts/restore-period-statuses.ts [fichier]                → base locale, à blanc
 *   npx tsx scripts/restore-period-statuses.ts --prod                   → prod, à blanc (lecture seule)
 *   npx tsx scripts/restore-period-statuses.ts --prod --apply           → prod, écrit — UNIQUEMENT sur accord explicite de Thomas
 * Fichier par défaut : la sauvegarde ci-dessus (chemin relatif à la racine du dépôt).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prodPrisma, localPrisma } from './_env';

const target = process.argv.includes('--prod') ? 'PROD' : 'LOCAL';
const apply = process.argv.includes('--apply');
const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
  ?? resolve(process.cwd(), '../../backups/manual-prod-period-statuses-2026-11-20T12-29-03-337Z.json'); // lancé depuis apps/api
const p = target === 'PROD' ? prodPrisma() : localPrisma();

async function main() {
  console.log(`=== Restauration des statuts de Période — ${target} — ${apply ? 'ÉCRITURE' : 'À BLANC'} ===`);
  console.log(`Sauvegarde : ${file}`);
  const saved: Array<{ id: string; status: string | null }> = JSON.parse(readFileSync(file, 'utf8'));
  const items = await p.item.findMany({
    where: { id: { in: saved.map((s) => s.id) } },
    select: { id: true, type: true, status: true, title: true },
  });
  const byId = new Map(items.map((it) => [it.id, it]));
  const counts: Record<string, number> = {};
  let restored = 0, skipped = 0;
  for (const s of saved) {
    const it = byId.get(s.id);
    if (!it) { skipped++; console.log(`  absent (supprimé ?) ${s.id}`); continue; }
    if (it.type !== 'PERIOD') { skipped++; console.log(`  type changé (${it.type}) « ${it.title} » — inchangé`); continue; }
    if (it.status) { skipped++; console.log(`  statut déjà posé (${it.status}) « ${it.title} » — inchangé`); continue; }
    if (!s.status) continue;
    restored++;
    counts[s.status] = (counts[s.status] ?? 0) + 1;
    if (apply) await p.item.update({ where: { id: it.id }, data: { status: s.status } });
  }
  console.log('Statuts remis :', Object.keys(counts).length ? counts : 'aucun');
  console.log(`Bilan : ${saved.length} dans la sauvegarde, ${restored} à remettre, ${skipped} laissé(s) tel(s) quel(s)${apply ? '' : ' — rien écrit (à blanc)'}`);
}

main().catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; }).finally(() => p.$disconnect());

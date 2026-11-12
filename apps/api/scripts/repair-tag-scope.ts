/**
 * Réparation des tags hors de portée (2026-11-12, bug « des tags d'une communauté apparaissent dans une autre »).
 * Un élément ne doit porter que des tags visibles depuis son espace (utils/tagScope.ts : globaux, sa communauté, son
 * espace et ses ancêtres). Des liens incohérents existent en base : espaces déplacés d'une communauté à l'autre avant
 * le remappage de PATCH /spaces/:id, déplacements anciens, fusions de la migration des tags d'espace, éléments
 * déplacés depuis cette migration. Chaque tag hors de portée est remplacé par le tag visible de même nom, sinon
 * recréé en tag de l'espace de l'élément (remapOutOfScopeItemTags, même règle que les déplacements).
 *
 * Exécuter : npx tsx apps/api/scripts/repair-tag-scope.ts [--prod] [--apply]
 * Sans --apply : bilan seulement (« → à créer » quand aucun tag de même nom n'est visible). --prod : base de prod, sur
 * demande explicite de Thomas seulement, après le déploiement et après migrate-space-tags.ts --restore.
 * Rejouable : un second passage ne trouve plus rien.
 */
import { prodPrisma, localPrisma, isProd } from './_env';
import { remapOutOfScopeItemTags } from '../src/utils/tagScope.js';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');

async function main() {
  const env = isProd ? 'PROD' : 'local';
  console.log(`[${env}] ${apply ? 'RÉPARATION' : 'BILAN (sans --apply, rien n\'est écrit)'} des tags hors de portée`);
  // Espaces dont au moins un élément porte un tag
  const spaces = await prisma.space.findMany({
    where: { items: { some: { tags: { some: {} } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  let total = 0;
  for (const space of spaces) {
    const done = await remapOutOfScopeItemTags(prisma, [space.id], apply);
    if (done.length === 0) continue;
    total += done.length;
    console.log(`  « ${space.name} » [${space.id}] : ${done.length} lien(s)`);
    for (const d of done) console.log(`     - élément ${d.itemId} : « ${d.fromName} » [${d.fromId}] → ${d.toId || 'à créer (tag d\'espace)'}`);
  }
  console.log(`Total : ${total} lien(s) ${apply ? 'remappé(s)' : 'à remapper'} sur ${spaces.length} espace(s) tagué(s).`);
}

main().finally(() => prisma.$disconnect());

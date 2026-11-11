/**
 * Recopie unique (contenus multiples, lot 1, 2026-11-08) : crée les contenus (table item_contents) des éléments
 * existants à partir de Item.url et content.xml, SANS rien retirer ni modifier dans l'existant (Item.url et content
 * restent en place jusqu'au lot 4). Correspondance :
 *   IMAGE + url → IMAGE ; DOCUMENT + url → FILE (nom et type déduits de l'adresse) ; LINK + url → LINK ;
 *   DIAGRAM + content.xml → DIAGRAM (xml, url d'aperçu si présente) ; DIAGRAM + url sans xml → IMAGE.
 * (Correspondance définie dans scripts/_legacyContent.ts — draftForLegacy, ex-pont du lot 2 retiré au lot 4.)
 * Rejouable : un élément qui a déjà au moins un contenu est ignoré. Les autres types qui portent une url sont
 * seulement comptés (décision au lot 4).
 * Sans --apply : bilan seulement. --prod : base de prod (via _env.ts), à lancer APRÈS le déploiement du schéma,
 * sur demande explicite de Thomas.
 * Exécuter : npx tsx apps/api/scripts/backfill-item-contents.ts [--prod] [--apply]
 */
import { prodPrisma, localPrisma, isProd } from './_env';
import { draftForLegacy, type LegacyDraft as Draft } from './_legacyContent';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');

type Source = { id: string; type: string; url: string | null; content: unknown; createdById: string; createdAt: Date };
// Correspondance ancien champ → contenu : scripts/_legacyContent.ts (partagée avec migrate-item-types.ts)
const draftFor = (item: Source) => draftForLegacy(item);

async function main() {
  const candidates: Source[] = await prisma.item.findMany({
    where: { type: { in: ['IMAGE', 'DOCUMENT', 'LINK', 'DIAGRAM'] }, contents: { none: {} } },
    select: { id: true, type: true, url: true, content: true, createdById: true, createdAt: true },
  });
  const drafts = candidates.map(draftFor).filter((d): d is Draft => d !== null);
  const already = await prisma.item.count({ where: { contents: { some: {} } } });
  const otherWithUrl = await prisma.item.groupBy({
    by: ['type'], where: { url: { not: null }, type: { notIn: ['IMAGE', 'DOCUMENT', 'LINK', 'DIAGRAM'] } }, _count: true,
  });

  const byKind = drafts.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] ?? 0) + 1 }), {});
  const byType = candidates.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {});
  console.log(`[${isProd ? 'PROD' : 'local'}] ${apply ? 'RECOPIE' : 'BILAN (sans --apply, rien n\'est écrit)'}`);
  console.log(`  Éléments déjà pourvus de contenus (ignorés) : ${already}`);
  console.log(`  Éléments candidats sans contenu : ${candidates.length}`, byType);
  console.log(`  Contenus à créer : ${drafts.length}`, byKind);
  console.log(`  Sans rien à recopier (ni url ni xml) : ${candidates.length - drafts.length}`);
  console.log('  Autres types portant une url (non touchés, lot 4) :',
    Object.fromEntries(otherWithUrl.map((g: any) => [g.type, g._count])));
  if (!apply || drafts.length === 0) return;

  let created = 0;
  for (let i = 0; i < drafts.length; i += 500) {
    const res = await prisma.itemContent.createMany({ data: drafts.slice(i, i + 500) });
    created += res.count;
  }
  console.log(`Contenus créés : ${created}`);
}

main().finally(() => prisma.$disconnect());

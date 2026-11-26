/*
 * Composition à la souris des articles (décision Thomas 2026-11-26) : l'ancien réglage « position » d'un bloc (align
 * left / right : image flottante, habillée par le texte du bloc suivant) disparaît. Ce script le convertit en ligne de
 * deux blocs, pour garder la mise en page des articles existants :
 * - align = left  : le bloc (image) à 40 %, puis le bloc suivant à côté à 60 % ;
 * - align = right : le bloc suivant d'abord à 60 %, puis le bloc (image) à côté à 40 % (positions échangées).
 * Conversion seulement si le bloc et le suivant sont chacun seuls sur leur ligne (ni l'un ni l'autre « à côté », et
 * le bloc d'après n'est pas « à côté » du suivant). Sinon le bloc est simplement remis centré (signalé dans le détail).
 * Tout bloc traité repasse align = 'center' : le script est rejouable sans effet. Les largeurs 'full' / 'wide' /
 * 'medium' restantes n'ont pas besoin de conversion (lues 100 / 75 / 67 par parseArticleBlockWidth).
 * N'écrit que article_blocks (pas de journal d'audit : conversion technique).
 * Usage (depuis apps/api) :
 *   npx tsx scripts/migrate-article-layout.ts                → base locale, à blanc (comptes + détail)
 *   npx tsx scripts/migrate-article-layout.ts --apply        → base locale, écrit
 *   npx tsx scripts/migrate-article-layout.ts --prod         → prod, à blanc (lecture seule)
 *   npx tsx scripts/migrate-article-layout.ts --prod --apply → prod, écrit — UNIQUEMENT sur accord explicite de Thomas,
 *   après la MEP du lot « composition des articles à la souris ».
 */
import { prodPrisma, localPrisma } from './_env';

const target = process.argv.includes('--prod') ? 'PROD' : 'LOCAL';
const apply = process.argv.includes('--apply');
const p = target === 'PROD' ? prodPrisma() : localPrisma();

type Row = { id: string; articleId: string; position: number; align: string; beside: boolean };

async function main() {
  console.log(`=== Disposition des articles — ${target} — ${apply ? 'ÉCRITURE' : 'À BLANC'} ===`);
  const floated: Row[] = await p.articleBlock.findMany({
    where: { align: { in: ['left', 'right'] } },
    select: { id: true, articleId: true, position: true, align: true, beside: true },
  });
  const articleIds = [...new Set(floated.map((b) => b.articleId))];
  let converted = 0;
  let centered = 0;
  for (const articleId of articleIds) {
    const blocks: Row[] = await p.articleBlock.findMany({
      where: { articleId }, orderBy: { position: 'asc' },
      select: { id: true, articleId: true, position: true, align: true, beside: true },
    });
    const used = new Set<string>();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.align !== 'left' && b.align !== 'right') continue;
      const next = blocks[i + 1];
      const after = blocks[i + 2];
      const pairable = !b.beside && next && !next.beside && !used.has(next.id) && (!after || !after.beside);
      if (!pairable) {
        centered++;
        console.log(`  article ${articleId} : bloc ${b.id} (${b.align}) remis centré — pas de bloc seul à côté`);
        if (apply) await p.articleBlock.update({ where: { id: b.id }, data: { align: 'center' } });
        continue;
      }
      converted++;
      used.add(b.id).add(next.id);
      console.log(`  article ${articleId} : bloc ${b.id} (${b.align}) + ${next.id} → ligne ${b.align === 'left' ? 'image | texte' : 'texte | image'}`);
      if (!apply) continue;
      await p.$transaction(async (tx: any) => {
        if (b.align === 'left') {
          await tx.articleBlock.update({ where: { id: b.id }, data: { align: 'center', width: '40', beside: false } });
          await tx.articleBlock.update({ where: { id: next.id }, data: { width: '60', beside: true } });
        } else {
          await tx.articleBlock.update({ where: { id: next.id }, data: { position: b.position, width: '60', beside: false } });
          await tx.articleBlock.update({ where: { id: b.id }, data: { position: next.position, align: 'center', width: '40', beside: true } });
        }
      });
    }
  }
  console.log(`Bilan : ${floated.length} bloc(s) flottant(s) dans ${articleIds.length} article(s) — ${converted} converti(s) en ligne, ${centered} remis centré(s)${apply ? '' : ' — rien écrit (à blanc)'}`);
}

main().catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; }).finally(() => p.$disconnect());

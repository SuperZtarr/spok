/*
 * Statuts propres aux réunions et aux articles (décision Thomas 2026-11-19, option A : partout, existants compris) :
 * convertit le statut des éléments MEETING et ARTICLE existants vers leurs statuts réservés (DEFAULT_STATUSES,
 * @spok/shared). Correspondance décidée avec Thomas :
 * - Réunion : vide / Non défini / À faire / En retard → À organiser ; Planifié / En cours → Planifiée ;
 *   À valider → Réalisée ; Terminé → CR envoyé ; Annulé → Annulée.
 * - Article : vide / Non défini / À faire / Planifié / En cours / En retard → Brouillon ; À valider → À valider ;
 *   Terminé → Publié ; Annulé → Annulé.
 * - Période : plus touchée (le vidage du 2026-11-20 est annulé, 2026-11-25 : scripts/restore-period-statuses.ts).
 * - Statut propre à une communauté (inconnu ici) : statusForType (premier statut du type), signalé dans le détail.
 * Éléments déjà à un statut de leur type : inchangés. Copies de séance verrouillées (lockedAt) : jamais modifiées.
 * N'écrit que le statut (pas de date, pas de journal d'audit : conversion technique).
 * Usage (depuis apps/api) :
 *   npx tsx scripts/migrate-type-statuses.ts                → base locale, à blanc (comptes + détail)
 *   npx tsx scripts/migrate-type-statuses.ts --apply        → base locale, écrit
 *   npx tsx scripts/migrate-type-statuses.ts --prod         → prod, à blanc (lecture seule)
 *   npx tsx scripts/migrate-type-statuses.ts --prod --apply → prod, écrit — UNIQUEMENT sur accord explicite de Thomas,
 *   après la MEP du lot (sinon l'API en place ne connaît pas ces statuts).
 */
import { statusAllowedForType, statusForType } from '@spok/shared';
import { prodPrisma, localPrisma } from './_env';

const MAP: Record<string, Record<string, string>> = {
  MEETING: {
    '': 'meeting_to_organize', undefined: 'meeting_to_organize', todo: 'meeting_to_organize', late: 'meeting_to_organize',
    scheduled: 'meeting_planned', in_progress: 'meeting_planned',
    to_validate: 'meeting_held', done: 'meeting_minutes_sent', cancelled: 'meeting_cancelled',
  },
  ARTICLE: {
    '': 'article_draft', undefined: 'article_draft', todo: 'article_draft', scheduled: 'article_draft',
    in_progress: 'article_draft', late: 'article_draft',
    to_validate: 'article_to_validate', done: 'article_published', cancelled: 'article_cancelled',
  },
};

const target = process.argv.includes('--prod') ? 'PROD' : 'LOCAL';
const apply = process.argv.includes('--apply');
const p = target === 'PROD' ? prodPrisma() : localPrisma();

async function main() {
  console.log(`=== Statuts Réunion / Article — ${target} — ${apply ? 'ÉCRITURE' : 'À BLANC'} ===`);
  const items = await p.item.findMany({
    where: { type: { in: Object.keys(MAP) as any }, lockedAt: null },
    select: { id: true, type: true, status: true, title: true },
  });
  const counts: Record<string, number> = {};
  let kept = 0, unknown = 0;
  for (const it of items) {
    const current = it.status ?? '';
    if (current && statusAllowedForType(current, it.type)) { kept++; continue; }
    let next = MAP[it.type][current];
    if (!next) {
      next = statusForType(it.type, current) as string;
      unknown++;
      console.log(`  statut inconnu « ${current} » (${it.type}) « ${it.title} » → ${next}`);
    }
    const key = `${it.type} ${current || '(vide)'} → ${next}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (apply) await p.item.update({ where: { id: it.id }, data: { status: next } });
  }
  console.log('Conversions :', Object.keys(counts).length ? counts : 'aucune');
  console.log(`Bilan : ${items.length} élément(s) examiné(s), ${kept} déjà au bon statut, ${unknown} statut(s) inconnu(s)${apply ? '' : ' — rien écrit (à blanc)'}`);
}

main().catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; }).finally(() => p.$disconnect());

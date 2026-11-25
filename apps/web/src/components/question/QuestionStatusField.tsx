/*
 * QuestionStatusField — champ « Statut » d'une Question dans la fiche complète (ItemEditModal, 2026-11-11) : ses 4 statuts
 * réservés (Ouverte, Tranchée, Reportée, Sans conclusion), le statut actuel en surbrillance. Le statut d'une question EST
 * son issue : chaque choix s'applique tout de suite par l'issue (useQuestion.setOutcome), hors « Enregistrer ».
 * 5 issues (2026-11-21) dans l'ordre et les couleurs du registre des statuts, chacune avec son sens toujours visible
 * (hints meaning_<id>). « Tranchée » (réponse du groupe) et « Arbitrée » (décision d'une autorité) demandent une
 * réponse : le bouton amène aux votes, avec la consigne en ligne (pickAnswer).
 * Props : spaceId / itemId (question enregistrée), statuses (référentiel de l'espace, libellés et couleurs ; défaut sinon).
 * Droits : canDecide de l'API (QuestionView) — sans droit, lecture du statut seule. Textes : fiche d'aide 'question'.
 */
import { useState } from 'react';
import { DEFAULT_STATUSES, QUESTION_STATUS, isQuestionAnswered, statusesForType, withDefaultStatuses, type StatusConfig } from '@spok/shared';
import { useQuestion } from '../../hooks/useQuestion';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

interface Props {
  spaceId: string;
  itemId: string;
  statuses?: StatusConfig[];
}

/** Rappel fonctionnel de chaque statut (lu au rendu : la fiche d'aide n'est pas lue au chargement du module) */
const hintFor = (status: string) => ({
  [QUESTION_STATUS.OPEN]: pageHint('question', 'reopen'),
  [QUESTION_STATUS.DECIDED]: pageHint('question', 'statusDecided'),
  [QUESTION_STATUS.POSTPONED]: pageHint('question', 'postpone'),
  [QUESTION_STATUS.NO_CONCLUSION]: pageHint('question', 'noConclusion'),
  [QUESTION_STATUS.ARBITRATED]: pageHint('question', 'statusArbitrated'),
} as Record<string, string | undefined>)[status];

/** Sens court de chaque issue, affiché sous son nom (fiche d'aide 'question', hints meaning*) */
const meaningOf = (status: string) => pageHint('question', `meaning_${status}`);

/** Amène au bloc Question (réponses à retenir) */
const showAnswers = () =>
  document.querySelector('[data-help-zone="question:vote"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

export function QuestionStatusField({ spaceId, itemId, statuses }: Props) {
  const { question, setOutcome } = useQuestion(spaceId, itemId);
  const [needAnswer, setNeedAnswer] = useState(false);
  // Ordre et couleurs : registre des statuts (référentiel de l'espace, sinon défauts)
  const options = statusesForType(DEFAULT_STATUSES, 'QUESTION')
    .map((d) => ({ ...d, ...(withDefaultStatuses(statuses ?? []).find((s) => s.id === d.id) ?? {}) }))
    .sort((a, b) => a.order - b.order);
  const current = question?.status ?? QUESTION_STATUS.OPEN;

  return (
    <div className="space-y-2" data-tour="item-status" data-devzone="item-statut">
      <label className="text-sm font-medium">Statut</label>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => {
          const selected = s.id === current;
          const cls = `px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${s.borderColor} ${selected ? 'font-semibold shadow-sm ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'}`;
          // Sens de l'issue, toujours visible sous son nom (2026-11-21 : « je ne vois pas comment on valide la réponse »)
          const meaning = <span className="block text-[11px] font-normal leading-tight text-muted-foreground">{meaningOf(s.id)}</span>;
          if (!question?.canDecide) {
            return selected ? <span key={s.id} className={cls}>{s.label}{meaning}</span> : null;
          }
          const apply = () => {
            // Tranchée / Arbitrée demandent une réponse : on amène aux votes, avec la consigne en ligne
            if (isQuestionAnswered(s.id)) { if (!selected) { setNeedAnswer(true); showAnswers(); } return; }
            if (!selected) setOutcome.mutate({ status: s.id });
          };
          return (
            <HelpHint key={s.id} text={hintFor(s.id)}>
              <button type="button" disabled={setOutcome.isPending} onClick={apply} className={`${cls} text-left`}>{s.label}{meaning}</button>
            </HelpHint>
          );
        })}
      </div>
      {needAnswer && question?.open && <p className="text-xs text-primary">{pageHint('question', 'pickAnswer')}</p>}
    </div>
  );
}

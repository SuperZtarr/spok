/*
 * QuestionStatusField — champ « Statut » d'une Question dans la fiche complète (ItemEditModal, 2026-11-11) : ses 4 statuts
 * réservés (Ouverte, Tranchée, Reportée, Sans conclusion), le statut actuel en surbrillance. Le statut d'une question EST
 * son issue : chaque choix s'applique tout de suite par l'issue (useQuestion.setOutcome), hors « Enregistrer ».
 * « Tranchée » demande une réponse : le bouton amène au bloc Question, où l'on retient une réponse (« Retenir »).
 * Props : spaceId / itemId (question enregistrée), statuses (référentiel de l'espace, libellés et couleurs ; défaut sinon).
 * Droits : canDecide de l'API (QuestionView) — sans droit, lecture du statut seule. Textes : fiche d'aide 'question'.
 */
import { DEFAULT_STATUSES, QUESTION_STATUS, statusesForType, type StatusConfig } from '@spok/shared';
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
} as Record<string, string | undefined>)[status];

/** Amène au bloc Question (réponses à retenir) */
const showAnswers = () =>
  document.querySelector('[data-help-zone="question:vote"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

export function QuestionStatusField({ spaceId, itemId, statuses }: Props) {
  const { question, setOutcome } = useQuestion(spaceId, itemId);
  const options = statusesForType(DEFAULT_STATUSES, 'QUESTION').map((d) => ({ ...d, ...(statuses?.find((s) => s.id === d.id) ?? {}) }));
  const current = question?.status ?? QUESTION_STATUS.OPEN;

  return (
    <div className="space-y-2" data-tour="item-status" data-devzone="item-statut">
      <label className="text-sm font-medium">Statut</label>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => {
          const selected = s.id === current;
          const cls = `px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${s.borderColor} ${selected ? 'font-semibold shadow-sm ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'}`;
          if (!question?.canDecide) {
            return selected ? <span key={s.id} className={cls}>{s.label}</span> : null;
          }
          const apply = () => {
            if (s.id === QUESTION_STATUS.DECIDED) { if (!selected) showAnswers(); return; }
            if (!selected) setOutcome.mutate({ status: s.id });
          };
          return (
            <HelpHint key={s.id} text={hintFor(s.id)}>
              <button type="button" disabled={setOutcome.isPending} onClick={apply} className={cls}>{s.label}</button>
            </HelpHint>
          );
        })}
      </div>
    </div>
  );
}

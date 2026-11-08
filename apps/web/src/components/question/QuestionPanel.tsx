/*
 * QuestionPanel — bloc d'un élément Question (type QUESTION, 2026-11-08) : options et votes nominatifs, issue,
 * préparation des options. Monté dans la fiche (ItemEditModal : formulaire et mode Afficher) et dans la fenêtre en
 * direct d'une séance (LiveWindow, variant="live" : gros boutons d'issue pour l'animateur, pas d'édition des options).
 * Props : spaceId / itemId (la question — en séance, la copie verrouillée), variant ('sheet' | 'live').
 * Droits : ceux calculés par l'API dans QuestionView (canVote, canDecide, canEditOptions) — rien n'est recalculé ici.
 * Les votes ne tranchent jamais : l'option en tête est seulement mise en avant ; l'issue se note par les boutons
 * (canDecide). Textes : fiche d'aide 'question' (components/help/question.help.ts), jamais en dur.
 * Posé dans un <form> (fiche) : tous les boutons sont type="button" et Entrée dans un champ ne soumet pas la fiche.
 * Données : hooks/useQuestion (queryKey ['question', spaceId, itemId]) ; en séance, relu à chaque événement SSE.
 */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_STATUSES, QUESTION_STATUS, type QuestionView } from '@spok/shared';
import { useQuestion } from '../../hooks/useQuestion';
import { useReferentiels } from '../../hooks/useReferentiels';
import { HelpHint } from '../../help/HelpHint';
import { FieldHelp } from '../../help/FieldHelp';
import { PageHelpButton } from '../../help/PageHelpButton';
import { pageHint } from '../../help/pageHint';

interface Props {
  spaceId: string;
  itemId: string;
  variant?: 'sheet' | 'live';
}

const noSubmit = (e: KeyboardEvent<HTMLInputElement>, action?: () => void) => {
  if (e.key === 'Enter') { e.preventDefault(); action?.(); }
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : e ? String(e) : null);

export function QuestionPanel({ spaceId, itemId, variant = 'sheet' }: Props) {
  const { question, isLoading, vote, setOutcome, saveOptions } = useQuestion(spaceId, itemId);
  const { data: refData } = useReferentiels(spaceId);
  const statuses = refData?.referentiels?.statuses ?? DEFAULT_STATUSES;
  const statusLabel = (id: string) => statuses.find((s) => s.id === id)?.label ?? DEFAULT_STATUSES.find((s) => s.id === id)?.label ?? id;
  const live = variant === 'live';

  if (isLoading || !question) return null;
  const error = errorText(vote.error ?? setOutcome.error ?? saveOptions.error);

  return (
    <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900 dark:bg-sky-950/20" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{statusLabel(question.status ?? QUESTION_STATUS.OPEN)}</span>
        <span className="text-xs text-muted-foreground">· {question.voterCount} {question.voterCount > 1 ? 'votants' : 'votant'}</span>
        <span className="flex-1" />
        {!live && <PageHelpButton pageKey="question" />}
      </div>

      <Votes question={question} onVote={(ids) => vote.mutate(ids)} pending={vote.isPending} live={live} />

      <Outcome question={question} live={live} statusLabel={statusLabel} pending={setOutcome.isPending}
        onOutcome={(body) => setOutcome.mutate(body)} />

      {!live && question.canEditOptions && (
        <OptionsEditor question={question} pending={saveOptions.isPending} onSave={(body) => saveOptions.mutate(body)} />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Votes({ question, onVote, pending, live }: { question: QuestionView; onVote: (ids: string[]) => void; pending: boolean; live: boolean }) {
  const mine = new Set(question.myOptionIds);
  const toggle = (id: string) => {
    if (question.multiple) onVote(mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]);
    else onVote(mine.has(id) ? [] : [id]);
  };
  return (
    <div data-help-zone="question:vote" className="space-y-1.5">
      {question.options.length === 0 && <FieldHelp page="question" field="noOptions" />}
      {question.options.map((o) => {
        const leading = question.leadingOptionIds.includes(o.id);
        const chosen = question.outcome.chosenOptionId === o.id;
        const checked = mine.has(o.id);
        return (
          <div key={o.id} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 ${chosen ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : leading ? 'border-sky-400 bg-white dark:bg-background' : 'border-border bg-white dark:bg-background'}`}>
            {question.canVote ? (
              <HelpHint text={pageHint('question', checked ? 'voteClear' : 'vote')}>
                <button type="button" disabled={pending} onClick={() => toggle(o.id)} aria-label={o.label}
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 ${question.multiple ? 'rounded' : 'rounded-full'} ${checked ? 'border-sky-600 bg-sky-600 text-white' : 'border-muted-foreground/50 hover:border-sky-500'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </button>
              </HelpHint>
            ) : <span className="mt-0.5 h-5 w-5 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className={`flex items-baseline gap-2 ${live ? 'text-base' : 'text-sm'}`}>
                <span className={`flex-1 break-words ${leading ? 'font-semibold' : ''}`}>{o.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{o.voters.length}</span>
              </div>
              {o.voters.length > 0 && (
                <p className="text-xs text-muted-foreground">{o.voters.map((v) => v.name).join(', ')}</p>
              )}
            </div>
          </div>
        );
      })}
      {!question.open && question.options.length > 0 && <FieldHelp page="question" field="frozen" />}
      {question.open && question.canVote && <FieldHelp page="question" field="comment" />}
    </div>
  );
}

function Outcome({ question, live, statusLabel, pending, onOutcome }: {
  question: QuestionView; live: boolean; statusLabel: (id: string) => string; pending: boolean;
  onOutcome: (body: { status: string; chosenOptionId?: string | null; answerText?: string | null; note?: string | null }) => void;
}) {
  const [other, setOther] = useState('');
  const [note, setNote] = useState(question.outcome.note ?? '');
  useEffect(() => setNote(question.outcome.note ?? ''), [question.outcome.note]);
  const { outcome } = question;
  const chosen = question.options.find((o) => o.id === outcome.chosenOptionId);
  const status = question.status ?? QUESTION_STATUS.OPEN;
  const big = live ? 'px-4 py-3 text-base' : 'px-3 py-1.5 text-sm';
  const keepCurrent = { status, chosenOptionId: outcome.chosenOptionId, answerText: outcome.answerText };

  return (
    <div data-help-zone="question:issue" className="space-y-2">
      {!question.open && (
        <div className="text-sm">
          <span className="font-medium">{statusLabel(status)}</span>
          {chosen && <> : {chosen.label}</>}
          {!chosen && outcome.answerText && <> : {outcome.answerText}</>}
          {outcome.note && <span className="text-muted-foreground"> — {outcome.note}</span>}
          {outcome.decidedBy && (
            <span className="block text-xs text-muted-foreground">
              {outcome.decidedBy.name}{outcome.decidedAt ? `, ${new Date(outcome.decidedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
            </span>
          )}
        </div>
      )}

      {question.canDecide && question.open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {question.options.map((o) => (
              <HelpHint key={o.id} text={pageHint('question', 'decide')}>
                <button type="button" disabled={pending}
                  onClick={() => onOutcome({ status: QUESTION_STATUS.DECIDED, chosenOptionId: o.id })}
                  className={`rounded-md border-2 border-emerald-400 bg-white font-medium hover:bg-emerald-50 dark:bg-background ${big} ${question.leadingOptionIds.includes(o.id) ? 'ring-2 ring-sky-300' : ''}`}>
                  {o.label}
                </button>
              </HelpHint>
            ))}
            <HelpHint text={pageHint('question', 'postpone')}>
              <button type="button" disabled={pending} onClick={() => onOutcome({ status: QUESTION_STATUS.POSTPONED })}
                className={`rounded-md border-2 border-amber-300 bg-white hover:bg-amber-50 dark:bg-background ${big}`}>
                {statusLabel(QUESTION_STATUS.POSTPONED)}
              </button>
            </HelpHint>
            <HelpHint text={pageHint('question', 'noConclusion')}>
              <button type="button" disabled={pending} onClick={() => onOutcome({ status: QUESTION_STATUS.NO_CONCLUSION })}
                className={`rounded-md border-2 border-slate-300 bg-white hover:bg-slate-50 dark:bg-background ${big}`}>
                {statusLabel(QUESTION_STATUS.NO_CONCLUSION)}
              </button>
            </HelpHint>
          </div>
          <div className="flex gap-2">
            <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={500}
              onKeyDown={(e) => noSubmit(e, () => other.trim() && onOutcome({ status: QUESTION_STATUS.DECIDED, answerText: other.trim() }))}
              placeholder={statusLabel(QUESTION_STATUS.DECIDED)} aria-label="Autre réponse"
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
            <HelpHint text={pageHint('question', 'decideOther')}>
              <button type="button" disabled={pending || !other.trim()}
                onClick={() => onOutcome({ status: QUESTION_STATUS.DECIDED, answerText: other.trim() })}
                className="h-8 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50">
                <Check className="h-4 w-4" />
              </button>
            </HelpHint>
          </div>
          <FieldHelp page="question" field="otherAnswer" />
          {question.locked && <p className="text-xs text-muted-foreground">{pageHint('question', 'liveCopy')}</p>}
        </div>
      )}

      {question.canDecide && !question.open && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Précision"
            onKeyDown={(e) => noSubmit(e, () => onOutcome({ ...keepCurrent, note: note.trim() || null }))}
            placeholder="Précision" className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
          <HelpHint text={pageHint('question', 'note')}>
            <button type="button" disabled={pending || note.trim() === (outcome.note ?? '')}
              onClick={() => onOutcome({ ...keepCurrent, note: note.trim() || null })}
              className="h-8 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50">
              <Check className="h-4 w-4" />
            </button>
          </HelpHint>
          <HelpHint text={pageHint('question', 'reopen')}>
            <button type="button" disabled={pending} onClick={() => onOutcome({ status: QUESTION_STATUS.OPEN })}
              className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm hover:bg-accent">
              <RotateCcw className="h-3.5 w-3.5" /> {statusLabel(QUESTION_STATUS.OPEN)}
            </button>
          </HelpHint>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ question, pending, onSave }: {
  question: QuestionView; pending: boolean; onSave: (body: { multiple: boolean; options: Array<{ id?: string; label: string }> }) => void;
}) {
  const initial = useMemo(() => question.options.map((o) => ({ id: o.id as string | undefined, label: o.label })), [question.options]);
  const [rows, setRows] = useState(initial);
  const [multiple, setMultiple] = useState(question.multiple);
  useEffect(() => { setRows(initial); setMultiple(question.multiple); }, [initial, question.multiple]);
  const dirty = multiple !== question.multiple || JSON.stringify(rows) !== JSON.stringify(initial);
  const move = (i: number, d: number) => setRows((r) => {
    const next = [...r];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const save = () => onSave({ multiple, options: rows.map((r) => ({ ...r, label: r.label.trim() })).filter((r) => r.label) });

  return (
    <div data-help-zone="question:options" className="space-y-1.5 border-t pt-2">
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex items-center gap-1">
          <input value={r.label} maxLength={200} aria-label={`Option ${i + 1}`}
            onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            onKeyDown={(e) => noSubmit(e)}
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
          <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" aria-label="Descendre" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" aria-label="Retirer" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRows((rs) => [...rs, { id: undefined, label: '' }])}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Option
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> Choix multiple
        </label>
        <span className="flex-1" />
        <HelpHint text={pageHint('question', 'saveOptions')}>
          <button type="button" disabled={!dirty || pending} onClick={save}
            className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
            Enregistrer les options
          </button>
        </HelpHint>
      </div>
    </div>
  );
}

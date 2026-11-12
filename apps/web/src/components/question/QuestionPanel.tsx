/*
 * QuestionPanel — bloc d'un élément Question (type QUESTION, 2026-11-08) : options et votes nominatifs, issue,
 * préparation des options. Monté dans la fiche (ItemEditModal : formulaire et mode Afficher) et dans la fenêtre en
 * direct d'une séance (LiveWindow, variant="live" : gros boutons d'issue pour l'animateur, pas d'édition des options).
 * Fiche (2026-11-11) : trois étapes nommées dans l'ordre d'usage — 1. Réponses possibles (deux lignes vides au départ,
 * enregistrées au fil de l'eau par OptionsEditor ; retirer une réponse qui a des votes demande confirmation ; chaque
 * réponse peut être liée à un élément existant — ItemSearchPicker, 2026-11-12 —, dont le titre ouvre la fiche
 * (OptionLabel, sans navigation en séance ; élément non lisible par le lecteur : libellé seul, l'API ne l'envoie pas) ;
 * tant qu'aucun vote n'existe, « Partir d'un modèle » remplace les réponses — questionTemplates.ts, 2026-11-12), 2. Votes (une seule liste,
 * « Retenir » sur chaque ligne pour qui peut trancher), 3. Issue (Reportée, Sans conclusion, autre réponse, précision,
 * Rouvrir). En séance, pas d'étapes : gros boutons de réponse dans l'issue.
 * Props : spaceId / itemId (la question — en séance, la copie verrouillée), variant ('sheet' | 'live').
 * Droits : ceux calculés par l'API dans QuestionView (canVote, canDecide, canEditOptions) — rien n'est recalculé ici.
 * Les votes ne tranchent jamais : l'option en tête est seulement mise en avant (badge « Unanimité » si tous les votants,
 * au moins deux, l'ont choisie — unanimousOptionIds de l'API) ; l'issue se note par les boutons
 * (canDecide). Textes : fiche d'aide 'question' (components/help/question.help.ts), jamais en dur.
 * Posé dans un <form> (fiche) : tous les boutons sont type="button" et Entrée dans un champ ne soumet pas la fiche.
 * Données : hooks/useQuestion (queryKey ['question', spaceId, itemId]) ; en séance, relu à chaque événement SSE.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Link2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_STATUSES, QUESTION_STATUS, type QuestionOptionRef, type QuestionOptionView, type QuestionView } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { ItemSearchPicker, type ItemSearchHit } from '../ItemSearchPicker';
import { QUESTION_TEMPLATES, type QuestionTemplate } from './questionTemplates';
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
  // Fiche : étapes nommées et numérotées dans l'ordre d'usage (réponses possibles → votes → issue, 2026-11-11)
  const editOptions = !live && question.canEditOptions;
  const step = (n: number, title: string) => (live ? null : (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{n}. {title}</h3>
  ));
  const s = editOptions ? 1 : 0;

  return (
    <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-900 dark:bg-sky-950/20" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{statusLabel(question.status ?? QUESTION_STATUS.OPEN)}</span>
        <span className="text-xs text-muted-foreground">· {question.voterCount} {question.voterCount > 1 ? 'votants' : 'votant'}</span>
        <span className="flex-1" />
        {!live && <PageHelpButton pageKey="question" />}
      </div>

      {editOptions && (
        <div className="space-y-1.5">
          {step(1, 'Réponses possibles')}
          <OptionsEditor key={itemId} spaceId={spaceId} question={question} onSave={(body) => saveOptions.mutateAsync(body)} />
        </div>
      )}

      {question.options.length > 0 && (
        <div className="space-y-1.5">
          {step(s + 1, 'Votes')}
          <Votes question={question} onVote={(ids) => vote.mutate(ids)} pending={vote.isPending || setOutcome.isPending} live={live}
            onDecide={(id) => setOutcome.mutate({ status: QUESTION_STATUS.DECIDED, chosenOptionId: id })} />
        </div>
      )}
      {question.options.length === 0 && !editOptions && <FieldHelp page="question" field="noOptions" />}

      {(question.canDecide || !question.open) && (
        <div className="space-y-1.5">
          {step(s + (question.options.length > 0 ? 2 : 1), 'Issue')}
          <Outcome question={question} live={live} statusLabel={statusLabel} pending={setOutcome.isPending}
            onOutcome={(body) => setOutcome.mutate(body)} />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Pastille de l'élément lié dans l'éditeur ; élément non lisible par l'auteur : mention neutre */
function RefChip({ row }: { row: OptionRow }) {
  if (!row.refItem) return <span>{pageHint('question', 'refHidden')}</span>;
  const Icon = getTypeIcon(row.refItem.type);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <Link to={`/spaces/${row.refItem.spaceId}?item=${row.refItem.id}`} className="truncate hover:underline">{row.refItem.title}</Link>
    </span>
  );
}

/**
 * Libellé d'une réponse ; liée à un élément lisible (refItem) : icône de son type, et dans la fiche un lien qui ouvre
 * sa fiche (?item=). En séance, pas de navigation (l'animateur ne quitte pas la fenêtre en direct).
 */
function OptionLabel({ option, live }: { option: QuestionOptionView; live: boolean }) {
  const ref = option.refItem;
  if (!ref) return <>{option.label}</>;
  const Icon = getTypeIcon(ref.type);
  const inner = <><Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" />{option.label}</>;
  if (live) return inner;
  return (
    <HelpHint text={pageHint('question', 'openRef')}>
      <Link to={`/spaces/${ref.spaceId}?item=${ref.id}`} className="hover:underline">{inner}</Link>
    </HelpHint>
  );
}

function Votes({ question, onVote, onDecide, pending, live }: {
  question: QuestionView; onVote: (ids: string[]) => void; onDecide: (optionId: string) => void; pending: boolean; live: boolean;
}) {
  // Fiche : « Retenir » sur chaque réponse (une seule liste) ; en séance, gros boutons d'issue dans le bloc Issue
  const canPick = !live && question.canDecide && question.open;
  const mine = new Set(question.myOptionIds);
  const toggle = (id: string) => {
    if (question.multiple) onVote(mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]);
    else onVote(mine.has(id) ? [] : [id]);
  };
  return (
    <div data-help-zone="question:vote" className="space-y-1.5">
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
                <span className={`flex-1 break-words ${leading ? 'font-semibold' : ''}`}>
                  <OptionLabel option={o} live={live} />
                </span>
                {question.unanimousOptionIds.includes(o.id) && (
                  <HelpHint text={pageHint('question', 'unanimous')}>
                    <span className="rounded-full border border-emerald-400 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Unanimité</span>
                  </HelpHint>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">{o.voters.length}</span>
                {canPick && (
                  <HelpHint text={pageHint('question', 'decide')}>
                    <button type="button" disabled={pending} onClick={() => onDecide(o.id)}
                      className="rounded-md border border-emerald-400 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                      Retenir
                    </button>
                  </HelpHint>
                )}
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
          {chosen && <> : <OptionLabel option={chosen} live={live} /></>}
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
            {/* Réponses à retenir : ici en séance seulement — dans la fiche, « Retenir » est sur chaque ligne des votes */}
            {live && question.options.map((o) => (
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

type OptionRow = { key: string; id?: string; label: string; refItemId: string | null; refItem: QuestionOptionRef | null };
type OptionsBody = { multiple: boolean; options: Array<{ id?: string; label: string; refItemId: string | null }> };
let rowSeq = 0;
const newRow = (o?: QuestionOptionView): OptionRow => ({
  key: o?.id ?? `new-${++rowSeq}`, id: o?.id, label: o?.label ?? '', refItemId: o?.refItemId ?? null, refItem: o?.refItem ?? null,
});

/**
 * Réponses possibles, enregistrées au fil de l'eau (2026-11-11, plus de bouton) : en quittant un champ, sur Entrée
 * (qui passe à la ligne suivante, ou en ouvre une), au déplacement, au retrait, sur « Choix multiple ».
 * Les envois passent en file (un seul à la fois, lu sur l'état le plus récent) : une nouvelle réponse n'est jamais
 * créée deux fois. Retirer une réponse qui a des votes demande une confirmation en ligne (ses votes sont perdus).
 */
function OptionsEditor({ spaceId, question, onSave }: {
  spaceId: string; question: QuestionView; onSave: (body: OptionsBody) => Promise<QuestionView>;
}) {
  // Aucune réponse encore : deux lignes vides prêtes à remplir
  const fromServer = () => (question.options.length ? question.options.map((o) => newRow(o)) : [newRow(), newRow()]);
  const [rows, setRowsState] = useState<OptionRow[]>(fromServer);
  const [multiple, setMultipleState] = useState(question.multiple);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [pickKey, setPickKey] = useState<string | null>(null); // ligne dont on choisit l'élément lié
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  const multipleRef = useRef(multiple);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(0);
  const signatureOf = (view: QuestionView) =>
    JSON.stringify({ multiple: view.multiple, options: view.options.map((o) => ({ id: o.id, label: o.label, refItemId: o.refItemId ?? null })) });
  const lastSentRef = useRef(signatureOf(question));
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const setRows = (next: OptionRow[]) => { rowsRef.current = next; setRowsState(next); };
  const setMultiple = (v: boolean) => { multipleRef.current = v; setMultipleState(v); };

  // Changement venu d'ailleurs (autre membre, séance) : repris seulement si rien n'est en cours ici
  useEffect(() => {
    if (signatureOf(question) === lastSentRef.current) return; // rien de neuf (montage, retour de notre propre envoi)
    const local = rowsRef.current.filter((r) => r.label.trim());
    const inSync = local.every((r) => r.id && question.options.some((o) => o.id === r.id && o.label === r.label.trim() && (o.refItemId ?? null) === r.refItemId));
    if (pendingRef.current === 0 && inSync && local.length === question.options.length) {
      setRows(fromServer());
      setMultiple(question.multiple);
      lastSentRef.current = signatureOf(question);
    }
  }, [question.options, question.multiple]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusKey) { inputs.current.get(focusKey)?.focus(); setFocusKey(null); }
  }, [focusKey]);

  // Envoi de l'état le plus récent, après le précédent ; les nouvelles réponses reçoivent leur identifiant
  const persist = () => {
    pendingRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      const sent = rowsRef.current.filter((r) => r.label.trim());
      const body: OptionsBody = { multiple: multipleRef.current, options: sent.map((r) => ({ id: r.id, label: r.label.trim(), refItemId: r.refItemId })) };
      if (JSON.stringify(body) === lastSentRef.current) return;
      try {
        const view = await onSave(body);
        lastSentRef.current = signatureOf(view);
        // Les lignes envoyées reçoivent leur identifiant et l'élément lié tel que l'API le montre
        const savedByKey = new Map(sent.map((r, i) => [r.key, view.options[i]]));
        setRows(rowsRef.current.map((r) => {
          const saved = savedByKey.get(r.key);
          if (!saved) return r;
          return { ...r, id: r.id ?? saved.id, refItem: r.refItemId === (saved.refItemId ?? null) ? saved.refItem : r.refItem };
        }));
      } catch { /* erreur affichée par le bloc (saveOptions.error) */ }
    }).finally(() => { pendingRef.current -= 1; });
  };

  const votesOf = (r: OptionRow) => question.options.find((o) => o.id === r.id)?.voters.length ?? 0;
  const update = (key: string, label: string) => setRows(rowsRef.current.map((r) => (r.key === key ? { ...r, label } : r)));
  const move = (i: number, d: number) => {
    const next = [...rowsRef.current];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
    persist();
  };
  const remove = (key: string) => {
    setConfirmKey(null);
    setRows(rowsRef.current.filter((r) => r.key !== key));
    persist();
  };
  const askRemove = (r: OptionRow) => { if (votesOf(r) > 0) setConfirmKey(r.key); else remove(r.key); };
  // Lien vers un élément : la réponse vide prend son titre ; retirer le lien garde le texte
  const link = (key: string, hit: ItemSearchHit, type: string) => {
    setPickKey(null);
    setRows(rowsRef.current.map((r) => (r.key === key ? {
      ...r,
      label: r.label.trim() ? r.label : (hit.title ?? '').slice(0, 200),
      refItemId: hit.id,
      refItem: { id: hit.id, title: hit.title ?? '', type, spaceId: hit.spaceId },
    } : r)));
    persist();
  };
  const unlink = (key: string) => {
    setRows(rowsRef.current.map((r) => (r.key === key ? { ...r, refItemId: null, refItem: null } : r)));
    persist();
  };
  const add = () => {
    const row = newRow();
    setRows([...rowsRef.current, row]);
    setFocusKey(row.key);
  };
  // Modèles de réponse (2026-11-12) : proposés tant que la question est ouverte et sans vote ; un modèle remplace
  // toutes les réponses (aucun vote à perdre)
  const showTemplates = question.open && question.options.every((o) => o.voters.length === 0);
  const applyTemplate = (t: QuestionTemplate) => {
    setRows(t.options.map((label) => ({ ...newRow(), label })));
    setMultiple(false);
    persist();
  };
  const onEnter = (i: number) => {
    persist();
    const next = rowsRef.current[i + 1];
    if (next) setFocusKey(next.key);
    else if (rowsRef.current[i]?.label.trim()) add();
  };

  return (
    <div data-help-zone="question:options" className="space-y-1.5">
      {showTemplates && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{pageHint('question', 'templatesLead')}</span>
          {QUESTION_TEMPLATES.map((t) => (
            <HelpHint key={t.id} text={`${pageHint('question', 'template')} ${t.options.join(', ')}.`}>
              <button type="button" onClick={() => applyTemplate(t)}
                className="rounded-full border border-sky-300 bg-white px-2 py-0.5 hover:bg-sky-50 dark:bg-background dark:hover:bg-sky-950/30">
                {t.label}
              </button>
            </HelpHint>
          ))}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center gap-1">
            <input value={r.label} maxLength={200} aria-label={`Réponse ${i + 1}`} placeholder={`Réponse ${i + 1}`}
              ref={(el) => { if (el) inputs.current.set(r.key, el); else inputs.current.delete(r.key); }}
              onChange={(e) => update(r.key, e.target.value)}
              onBlur={persist}
              onKeyDown={(e) => noSubmit(e, () => onEnter(i))}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
            <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Descendre" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            <HelpHint text={pageHint('question', 'linkItem')}>
              <button type="button" aria-label="Lier un élément" aria-pressed={pickKey === r.key}
                onClick={() => setPickKey(pickKey === r.key ? null : r.key)}
                className={`p-1 hover:text-foreground ${pickKey === r.key ? 'text-primary' : 'text-muted-foreground'}`}><Link2 className="h-4 w-4" /></button>
            </HelpHint>
            <HelpHint text={pageHint('question', 'removeOption')}>
              <button type="button" aria-label="Retirer" onClick={() => askRemove(r)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </HelpHint>
          </div>
          {r.refItemId && (
            <div className="flex items-center gap-1 pl-2 text-xs text-muted-foreground">
              <RefChip row={r} />
              <HelpHint text={pageHint('question', 'unlinkItem')}>
                <button type="button" aria-label="Retirer le lien" onClick={() => unlink(r.key)} className="p-0.5 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </HelpHint>
            </div>
          )}
          {pickKey === r.key && (
            <div className="rounded-md border bg-background p-2">
              <ItemSearchPicker spaceId={spaceId} excludeIds={new Set([question.itemId])} actionLabel="Lier" autoFocus
                onPick={(hit) => link(r.key, hit, (hit as ItemSearchHit & { type?: string }).type ?? 'UNDEFINED')} />
            </div>
          )}
          {confirmKey === r.key && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs">
              <span className="flex-1">{pageHint('question', 'removeVotes')?.replace('{n}', String(votesOf(r)))}</span>
              <button type="button" onClick={() => remove(r.key)} className="rounded border border-destructive px-2 py-0.5 text-destructive hover:bg-destructive/10">Retirer</button>
              <button type="button" onClick={() => setConfirmKey(null)} className="rounded border px-2 py-0.5 hover:bg-accent">Annuler</button>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> Réponse
        </button>
        <HelpHint text={pageHint('question', 'multiple')}>
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={multiple} onChange={(e) => { setMultiple(e.target.checked); persist(); }} /> Choix multiple
          </label>
        </HelpHint>
      </div>
      <FieldHelp page="question" field="optionsAutosave" />
    </div>
  );
}

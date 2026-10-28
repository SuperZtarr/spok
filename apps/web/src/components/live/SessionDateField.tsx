/*
 * SessionDateField — champ « Date de la séance » (date prévue, AAAA-MM-JJ) qui donne son nom à la séance
 * (sessionNameFor). Partagé par « Préparer la séance » (NewSessionDialog) et « Créer la suite » (SuiteDialog).
 * Props : value / onChange (date AAAA-MM-JJ, '' si vidé — l'appelant bloque alors la création).
 * Aide sous le champ : hints.sessionDate de components/help/live-window.help.ts ; aperçu du nom affiché.
 */
import { PAGE_HELP } from '../../help/pageHelp';
import { sessionNameFor } from './sessionName';

export function SessionDateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return (
    <div className="mb-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Date de la séance
        <input
          type="date"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm font-normal"
        />
        {value && <span className="text-xs font-normal text-muted-foreground">→ « {sessionNameFor(value)} »</span>}
      </label>
      <p className="text-xs text-muted-foreground mt-1">{PAGE_HELP['live-window'].hints?.sessionDate}</p>
    </div>
  );
}

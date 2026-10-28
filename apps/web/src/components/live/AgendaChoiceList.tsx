/*
 * AgendaChoiceList — liste à cocher des éléments de premier niveau de l'espace parent, avec « avec ses N
 * sous-éléments » et « Tout cocher / Tout décocher ». Partagée par « Préparer la séance » (NewSessionDialog) et
 * l'ajout groupé à une séance existante (AddAgendaItemsDialog) : ne pas la recopier.
 * Props : choices (buildAgendaChoices), selection / onChange (état tenu par l'appelant, defaultSelection) ;
 * alreadyIds (facultatif) : éléments déjà dans la préparation, marqués « déjà dans la préparation » (restent cochables).
 * Liste vide : rien n'est rendu ici, l'appelant affiche son propre message.
 */
import type { AgendaChoice, AgendaSelection } from './initialAgenda';

interface Props {
  choices: AgendaChoice[];
  selection: Record<string, AgendaSelection>;
  onChange: (next: Record<string, AgendaSelection>) => void;
  alreadyIds?: ReadonlySet<string>;
}

export function AgendaChoiceList({ choices, selection, onChange, alreadyIds }: Props) {
  const update = (id: string, patch: Partial<AgendaSelection>) => onChange({ ...selection, [id]: { ...selection[id], ...patch } });
  const setAll = (checked: boolean) =>
    onChange(Object.fromEntries(Object.entries(selection).map(([id, s]) => [id, { ...s, checked }])));
  const checkedCount = choices.filter((c) => selection[c.id]?.checked).length;

  return (
    <>
      <div className="flex items-center gap-3 mb-2 text-xs">
        <button type="button" className="hover:underline" onClick={() => setAll(true)}>Tout cocher</button>
        <button type="button" className="hover:underline" onClick={() => setAll(false)}>Tout décocher</button>
        <span className="ml-auto text-muted-foreground">{checkedCount}/{choices.length} sélectionné{checkedCount > 1 ? 's' : ''}</span>
      </div>
      <ul className="max-h-[50vh] overflow-auto divide-y divide-border border border-border rounded-md">
        {choices.map((c) => {
          const sel = selection[c.id];
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={!!sel?.checked} onChange={(e) => update(c.id, { checked: e.target.checked })} />
                <span className="truncate">{c.title}</span>
                {alreadyIds?.has(c.id) && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">· déjà dans la préparation</span>
                )}
              </label>
              {c.childCount > 0 && (
                <label className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${sel?.checked ? 'cursor-pointer' : 'opacity-40'}`}>
                  <input
                    type="checkbox"
                    disabled={!sel?.checked}
                    checked={!!sel?.withChildren}
                    onChange={(e) => update(c.id, { withChildren: e.target.checked })}
                  />
                  avec {c.childCount > 1 ? `ses ${c.childCount} sous-éléments` : 'son sous-élément'}
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

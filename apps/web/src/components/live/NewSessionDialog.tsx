/*
 * NewSessionDialog — fenêtre « Préparer la séance », ouverte par « Nouvelle séance » (ParentSessionsButton).
 * Liste les éléments de premier niveau de l'espace parent (initialAgenda), tous cochés, chacun avec
 * « avec ses N sous-éléments » activé s'il en a ; « Tout cocher » / « Tout décocher » ; « Créer la séance »
 * envoie la sélection à onCreate (champ agenda de POST /live-sessions). Tout décoché = séance à préparation vide.
 * Section « Invités » (InviteePicker) : membres de la communauté sans accès à l'espace (liste fournie par l'API) ;
 *   ils verront la séance, jamais l'espace.
 * Props : spaceId (espace parent), onCreate(agenda, invitees) — l'appelant crée la séance et gère erreur/navigation ;
 * busy / error affichés tels quels ; onClose ferme sans rien créer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { itemsApi, liveSessionsApi } from '../../lib/api';
import { InviteePicker } from './InviteePicker';
import { buildAgendaChoices, defaultSelection, toAgendaPayload, type AgendaSelection } from './initialAgenda';

type AgendaPayload = ReturnType<typeof toAgendaPayload>;

export function NewSessionDialog({ spaceId, onCreate, onClose, busy, error }: {
  spaceId: string;
  onCreate: (agenda: AgendaPayload, invitees: string[]) => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['items', spaceId, 'live-initial-agenda'],
    queryFn: () => itemsApi.list(spaceId, { pageSize: 5000 }),
  });
  const { data: candidates } = useQuery({
    queryKey: ['live-invite-candidates', spaceId],
    queryFn: () => liveSessionsApi.inviteCandidates(spaceId),
  });
  const [invitees, setInvitees] = useState<string[]>([]);
  const choices = useMemo(() => buildAgendaChoices(data?.data ?? []), [data]);
  const [selection, setSelection] = useState<Record<string, AgendaSelection>>({});
  useEffect(() => { setSelection(defaultSelection(choices)); }, [choices]);

  const update = (id: string, patch: Partial<AgendaSelection>) =>
    setSelection((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const setAll = (checked: boolean) =>
    setSelection((prev) => Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, { ...s, checked }])));
  const checkedCount = choices.filter((c) => selection[c.id]?.checked).length;

  return (
    <Modal isOpen onClose={onClose} title="Préparer la séance" devName="NewSessionDialog">
      <p className="text-sm text-muted-foreground mb-3">
        Éléments de l'espace à ajouter à la préparation, dans cet ordre. Vous pourrez la modifier ensuite.
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : choices.length === 0 ? (
        <p className="text-sm text-muted-foreground p-2">Cet espace ne contient aucun élément : la préparation sera vide.</p>
      ) : (
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
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input type="checkbox" checked={!!sel?.checked} onChange={(e) => update(c.id, { checked: e.target.checked })} />
                    <span className="truncate">{c.title}</span>
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
      )}
      <h3 className="text-sm font-medium mt-4 mb-1">Invités</h3>
      <p className="text-xs text-muted-foreground mb-2">Membres de la communauté sans accès à cet espace : ils verront la séance, pas l'espace.</p>
      <InviteePicker candidates={candidates ?? []} selected={invitees} onChange={setInvitees} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="bordered" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button type="button" data-autofocus disabled={busy || isLoading} onClick={() => onCreate(toAgendaPayload(choices, selection), invitees)}>
          {busy ? 'Création…' : 'Créer la séance'}
        </Button>
      </div>
    </Modal>
  );
}

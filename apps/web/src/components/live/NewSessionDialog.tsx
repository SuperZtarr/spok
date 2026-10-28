/*
 * NewSessionDialog — fenêtre « Préparer la séance », ouverte par « Nouvelle séance » (ParentSessionsButton).
 * Liste les éléments de premier niveau de l'espace parent (initialAgenda), tous cochés, chacun avec
 * « avec ses N sous-éléments » activé s'il en a ; « Tout cocher » / « Tout décocher » ; « Créer la séance »
 * envoie la sélection à onCreate (champ agenda de POST /live-sessions). Tout décoché = séance à préparation vide.
 * Texte d'explication : hints.newSessionIntro de components/help/live-session.help.ts.
 * La liste à cocher est AgendaChoiceList (partagée avec l'ajout groupé AddAgendaItemsDialog).
 * « Date de la séance » (SessionDateField, aujourd'hui par défaut) : date PRÉVUE, qui donne le nom passé à onCreate.
 * Section « Invités » (InviteePicker) : membres de la communauté sans accès à l'espace (liste fournie par l'API) ;
 *   ils verront la séance, jamais l'espace. Liste vide → NoInviteCandidates (pourquoi + lien vers les membres).
 * Props : spaceId (espace parent), onCreate(agenda, invitees, name) — l'appelant crée la séance et gère erreur/navigation ;
 * busy / error affichés tels quels ; onClose ferme sans rien créer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { itemsApi, liveSessionsApi } from '../../lib/api';
import { InviteePicker } from './InviteePicker';
import { NoInviteCandidates } from './NoInviteCandidates';
import { AgendaChoiceList } from './AgendaChoiceList';
import { pageHint } from '../../help/pageHint';
import { SessionDateField } from './SessionDateField';
import { sessionNameFor, todayLocal } from './sessionName';
import { buildAgendaChoices, defaultSelection, toAgendaPayload, type AgendaSelection } from './initialAgenda';

type AgendaPayload = ReturnType<typeof toAgendaPayload>;

export function NewSessionDialog({ spaceId, onCreate, onClose, busy, error }: {
  spaceId: string;
  onCreate: (agenda: AgendaPayload, invitees: string[], name: string) => void;
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
  const [date, setDate] = useState(todayLocal());
  const choices = useMemo(() => buildAgendaChoices(data?.data ?? []), [data]);
  const [selection, setSelection] = useState<Record<string, AgendaSelection>>({});
  useEffect(() => { setSelection(defaultSelection(choices)); }, [choices]);

  return (
    <Modal isOpen onClose={onClose} title="Préparer la séance" devName="NewSessionDialog">
      <SessionDateField value={date} onChange={setDate} />
      <p className="text-sm text-muted-foreground mb-3">{pageHint('live-session', 'newSessionIntro')}</p>
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : choices.length === 0 ? (
        <p className="text-sm text-muted-foreground p-2">Cet espace ne contient aucun élément : la préparation sera vide.</p>
      ) : (
        <AgendaChoiceList choices={choices} selection={selection} onChange={setSelection} />
      )}
      <h3 className="text-sm font-medium mt-4 mb-1">Invités</h3>
      <p className="text-xs text-muted-foreground mb-2">Membres de la communauté sans accès à cet espace : ils verront la séance, pas l'espace.</p>
      <InviteePicker candidates={candidates ?? []} selected={invitees} onChange={setInvitees}
        emptyState={candidates ? <NoInviteCandidates spaceId={spaceId} /> : null} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="bordered" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button type="button" data-autofocus disabled={busy || isLoading || !date} onClick={() => onCreate(toAgendaPayload(choices, selection), invitees, sessionNameFor(date))}>
          {busy ? 'Création…' : 'Créer la séance'}
        </Button>
      </div>
    </Modal>
  );
}

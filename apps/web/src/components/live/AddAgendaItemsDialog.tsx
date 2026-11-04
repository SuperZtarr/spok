/*
 * AddAgendaItemsDialog — « Ajouter des éléments » du panneau Préparation (AgendaPanel). Deux moyens :
 * - recherche avec portée (ItemSearchPicker : cet espace, la communauté, tous mes espaces, selon les droits de chacun) :
 *   « Ajouter » → live.addToAgenda, immédiat, sans ses sous-éléments ; ouverte à tout membre de la séance (demande Thomas 2026-11-04) ;
 * - animateur/présentateurs seulement : ajout groupé des éléments de PREMIER NIVEAU de l'espace parent (même liste que
 *   « Préparer la séance », AgendaChoiceList). Déjà dans la préparation = marqués et décochés, les nouveaux cochés.
 *   « Ajouter » → live.addToAgendaBulk : ajoutés en fin de préparation, dans l'ordre de la liste. Un invité n'a pas accès à
 *   l'espace parent : cette liste ne lui est pas proposée (l'API refuserait).
 * Dans les deux cas, l'utilisateur est le présentateur des lignes ajoutées. Annuler : la liste cochée n'est pas ajoutée.
 * Props : state (séance : espace parent, préparation actuelle), live (handle useLiveSession), onClose.
 * La liste des items est relue à chaque ouverture (refetchOnMount) : c'est l'intérêt — les éléments ajoutés depuis.
 * Textes d'aide : hints addAgendaSearch et addAgendaIntro de components/help/live-window.help.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ItemSearchPicker } from '../ItemSearchPicker';
import { itemsApi } from '../../lib/api';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';
import { PAGE_HELP } from '../../help/pageHelp';
import { AgendaChoiceList } from './AgendaChoiceList';
import { buildAgendaChoices, defaultSelection, toAgendaPayload, type AgendaSelection } from './initialAgenda';

interface Props { state: LiveSessionState; live: LiveSessionHandle; onClose: () => void }

export function AddAgendaItemsDialog({ state, live, onClose }: Props) {
  const parentSpaceId = state.session.parentSpaceId;
  const canListParent = state.myRole !== 'PARTICIPANT';
  const { data, isLoading } = useQuery({
    queryKey: ['items', parentSpaceId, 'live-initial-agenda'],
    queryFn: () => itemsApi.list(parentSpaceId, { pageSize: 5000 }),
    refetchOnMount: 'always',
    enabled: canListParent,
  });
  const alreadyIds = useMemo(() => new Set(state.agenda.map((a) => a.sourceItemId)), [state.agenda]);
  const choices = useMemo(() => buildAgendaChoices(data?.data ?? []), [data]);
  const [selection, setSelection] = useState<Record<string, AgendaSelection>>({});
  // Sélection par défaut posée à l'arrivée de la liste, pas à chaque changement de la préparation (temps réel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelection(defaultSelection(choices, alreadyIds)); }, [choices]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload = toAgendaPayload(choices, selection);
  const hints = PAGE_HELP['live-window'].hints;

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await live.addToAgendaBulk(payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Ajouter à la préparation" devName="AddAgendaItemsDialog">
      <p className="text-sm text-muted-foreground mb-3">{hints?.addAgendaSearch}</p>
      <ItemSearchPicker
        autoFocus
        spaceId={parentSpaceId}
        communitySpaceId={state.session.spaceId}
        excludeSpaceId={state.session.spaceId}
        doneIds={alreadyIds}
        defaultScope={canListParent ? 'space' : 'community'}
        actionLabel="Ajouter"
        onPick={(hit) => live.addToAgenda(hit.id, hit.spaceId)}
      />
      {canListParent && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground mb-3">{hints?.addAgendaIntro}</p>
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
          ) : choices.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">L'espace parent ne contient aucun élément.</p>
          ) : (
            <AgendaChoiceList choices={choices} selection={selection} onChange={setSelection} alreadyIds={alreadyIds} />
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="bordered" onClick={onClose} disabled={busy}>{canListParent ? 'Annuler' : 'Fermer'}</Button>
        {canListParent && (
          <Button type="button" disabled={busy || isLoading || payload.length === 0} onClick={add}>
            {busy ? 'Ajout…' : `Ajouter les cochés (${payload.length})`}
          </Button>
        )}
      </div>
    </Modal>
  );
}

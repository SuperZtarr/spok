/*
 * AddAgendaItemsDialog — « Ajouter des éléments » du panneau Préparation (AgendaPanel) : ajout groupé, à une séance
 * déjà créée, d'éléments de PREMIER NIVEAU de l'espace parent (même liste que « Préparer la séance »,
 * AgendaChoiceList). Les éléments déjà dans la préparation sont marqués et décochés, les autres (nouveaux) cochés.
 * « Ajouter » → live.addToAgendaBulk (POST /live-sessions/:id/agenda/bulk) : ajoutés en fin de préparation, dans
 * l'ordre de la liste, l'utilisateur en est le présentateur. Annuler / fermeture : rien n'est ajouté.
 * Props : state (séance : espace parent, préparation actuelle), live (handle useLiveSession), onClose.
 * La liste des items est relue à chaque ouverture (refetchOnMount) : c'est l'intérêt — les éléments ajoutés depuis.
 * Textes d'aide : hints addAgendaIntro de components/help/live-window.help.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { itemsApi } from '../../lib/api';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';
import { PAGE_HELP } from '../../help/pageHelp';
import { AgendaChoiceList } from './AgendaChoiceList';
import { buildAgendaChoices, defaultSelection, toAgendaPayload, type AgendaSelection } from './initialAgenda';

interface Props { state: LiveSessionState; live: LiveSessionHandle; onClose: () => void }

export function AddAgendaItemsDialog({ state, live, onClose }: Props) {
  const parentSpaceId = state.session.parentSpaceId;
  const { data, isLoading } = useQuery({
    queryKey: ['items', parentSpaceId, 'live-initial-agenda'],
    queryFn: () => itemsApi.list(parentSpaceId, { pageSize: 5000 }),
    refetchOnMount: 'always',
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
      <p className="text-sm text-muted-foreground mb-3">{PAGE_HELP['live-window'].hints?.addAgendaIntro}</p>
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : choices.length === 0 ? (
        <p className="text-sm text-muted-foreground p-2">L'espace parent ne contient aucun élément.</p>
      ) : (
        <AgendaChoiceList choices={choices} selection={selection} onChange={setSelection} alreadyIds={alreadyIds} />
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="bordered" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button type="button" data-autofocus disabled={busy || isLoading || payload.length === 0} onClick={add}>
          {busy ? 'Ajout…' : `Ajouter (${payload.length})`}
        </Button>
      </div>
    </Modal>
  );
}

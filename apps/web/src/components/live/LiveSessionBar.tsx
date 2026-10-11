/*
 * LiveSessionBar — bandeau d'un espace de séance, rendu en 3e ligne de SpaceToolbar (liveSessionBarSlot) :
 * statut (préparée / en direct / terminée), présence, boutons « Préparation » (AgendaPanel — la préparation ;
 * libellé renommé à la demande de Thomas 2026-10-11), « Fil » (SessionTimeline), « Présenter » (recherche, en direct, host/présentateurs),
 * « Présentateurs » (host : choix parmi les membres de l'espace parent), « Démarrer la séance » (host, préparée)
 * et « Terminer » (host, en direct, avec confirmation) ; séance terminée : « Créer la suite » (host, si pas encore
 * de suite) ; liens « Suite de … » / « Suite : … » vers les séances liées. Panneaux en popover simples, pas de modale.
 * members = membres de l'espace PARENT (on peut désigner quelqu'un qui n'a pas encore rejoint).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { liveSessionsApi } from '../../lib/api';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { todayLocal } from './sessionName';
import type { LiveSessionState, SpaceMember } from '@spok/shared';
import { SessionTimeline } from './SessionTimeline';
import { PresenterPanel } from './PresenterPanel';
import { AgendaPanel } from './AgendaPanel';
import { ConfirmModal } from '../ConfirmModal';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';

type Panel = 'agenda' | 'timeline' | 'present' | 'presenters' | null;

interface Props {
  state: LiveSessionState;
  live: LiveSessionHandle;
  members: SpaceMember[];
  onOpenItem: (id: string) => void;
}

const STATUS_LABEL = { PREPARED: 'Séance préparée', LIVE: '● Séance en direct', ENDED: 'Séance terminée' } as const;

export function LiveSessionBar({ state, live, members, onOpenItem }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActive = useActiveLiveSessionStore((s) => s.setActive);
  const status = state.session.status;
  const { previousSession, nextSession } = state.session;
  const isLive = status === 'LIVE';
  const isHost = state.myRole === 'HOST';
  const canPresent = state.myRole !== 'PARTICIPANT' && isLive;
  const presenterIds = new Set(state.roles.filter((r) => r.role === 'PRESENTER').map((r) => r.userId));
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible'); }
  };

  const createSuite = () => run(async () => {
    const suite = await liveSessionsApi.createSuite(state.session.id, todayLocal());
    queryClient.invalidateQueries({ queryKey: ['spaces'] });
    queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] }); // barre latérale (Layout.tsx)
    queryClient.invalidateQueries({ queryKey: ['live-sessions-ongoing'] }); // bouton de l'en-tête
    queryClient.invalidateQueries({ queryKey: ['live-session', state.session.spaceId] });
    setActive(suite.session.spaceId);
    navigate(`/spaces/${suite.session.spaceId}`);
  });

  const togglePresenter = (userId: string, checked: boolean) => {
    const next = new Set(presenterIds);
    if (checked) next.add(userId); else next.delete(userId);
    run(() => live.setPresenters([...next]));
  };

  return (
    <div className="relative flex items-center gap-3 border-b border-border px-4 py-2 text-sm">
      <span className={`font-medium ${isLive ? 'text-red-600' : status === 'PREPARED' ? 'text-orange-600' : 'text-muted-foreground'}`}>
        {STATUS_LABEL[status]}
      </span>
      {isLive && (
        <span className="text-muted-foreground" title={state.presence.map((u) => u.name).join(', ')}>
          {state.presence.length} connecté{state.presence.length > 1 ? 's' : ''}
        </span>
      )}
      {previousSession && (
        <Link to={`/spaces/${previousSession.spaceId}`} className="text-xs text-muted-foreground hover:underline">Suite de {previousSession.spaceName}</Link>
      )}
      {nextSession && (
        <Link to={`/spaces/${nextSession.spaceId}`} className="text-xs text-muted-foreground hover:underline">Suite : {nextSession.spaceName}</Link>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <div className="flex-1" />
      <button className="hover:underline" onClick={() => toggle('agenda')}>Préparation ({state.agenda.length})</button>
      <button className="hover:underline" onClick={() => toggle('timeline')}>Fil</button>
      {canPresent && <button className="hover:underline" onClick={() => toggle('present')}>Présenter</button>}
      {isHost && status !== 'ENDED' && <button className="hover:underline" onClick={() => toggle('presenters')}>Présentateurs</button>}
      {isHost && status === 'PREPARED' && (
        <button className="rounded bg-orange-500 px-2 py-0.5 text-white" onClick={() => run(live.start)}>Démarrer la séance</button>
      )}
      {isHost && isLive && <button className="text-red-600 hover:underline" onClick={() => setConfirmEnd(true)}>Terminer</button>}
      {isHost && status === 'ENDED' && !nextSession && (
        <button className="rounded bg-orange-500 px-2 py-0.5 text-white" onClick={createSuite}>Créer la suite</button>
      )}
      {panel && (
        <div className="absolute right-4 top-full z-30 mt-1 w-[28rem] rounded-lg border border-border bg-background shadow-xl">
          {panel === 'agenda' && <AgendaPanel state={state} live={live} />}
          {panel === 'timeline' && (
            <SessionTimeline entries={state.entries} onOpenItem={(id) => { setPanel(null); onOpenItem(id); }} />
          )}
          {panel === 'present' && (
            <PresenterPanel sessionSpaceId={state.session.spaceId} onDisplay={(spaceId, itemId) => live.displayItem(itemId, spaceId)} />
          )}
          {panel === 'presenters' && (
            <ul className="max-h-72 overflow-auto p-2">
              {members.filter((m) => m.userId !== state.session.hostId).map((m) => (
                <li key={m.userId}>
                  <label className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={presenterIds.has(m.userId)} onChange={(e) => togglePresenter(m.userId, e.target.checked)} />
                    {m.name || m.email}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => { setConfirmEnd(false); run(live.end); }}
        title="Terminer la séance"
        message="Plus aucun élément ne pourra être présenté. L'espace de séance reste consultable et modifiable."
        confirmLabel="Terminer"
        confirmVariant="destructive"
      />
    </div>
  );
}

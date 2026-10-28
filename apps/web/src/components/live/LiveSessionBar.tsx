/*
 * LiveSessionBar — bandeau d'un espace de séance, rendu en 3e ligne de SpaceToolbar (liveSessionBarSlot) :
 * statut (préparée / en direct / terminée), présence, boutons « Préparation » (AgendaPanel — la préparation ;
 * libellé renommé à la demande de Thomas 2026-10-11), « Fil » (SessionTimeline), « Présenter » (recherche, en direct, host/présentateurs),
 * « Présentateurs » (host : choix parmi les membres de l'espace parent), « Invités » (host, toute séance : InviteesPanel —
 * invités qui voient la séance sans l'espace parent ; ajout tant que non terminée, retrait toujours), « Démarrer la séance » (host, préparée)
 * et « Terminer » (host, en direct, avec confirmation) ; séance terminée : « Créer la suite » (host, si pas encore
 * de suite) → SuiteDialog (date prévue de la suite, qui la nomme) ; liens « Suite de … » / « Suite : … » vers les séances liées. Panneaux en popover simples, pas de modale.
 * members = membres de l'espace PARENT (on peut désigner quelqu'un qui n'a pas encore rejoint).
 * Boutons orange (liveStyles.ts, 2026-10-28) : panneaux en orange clair, actions en orange vif, panneau ouvert = bouton
 * cerclé ; « Terminer » aussi en orange vif (confirmation conservée).
 * Aide (2026-10-28) : « ? » en tête du bandeau (fiche components/help/live-session.help.ts, tour sur les repères
 * live-*) ; l'explication d'un bouton est affichée DANS ce qu'il ouvre (décision Thomas) : en tête du panneau
 * (pageHint('live-session', <panneau>) — Préparation : par AgendaPanel), dans la confirmation de « Terminer », dans la
 * fenêtre de « Créer la suite » ; seul « Démarrer », qui n'ouvre rien, a une infobulle. Zones du mode Aide
 * live-session:bar / live-session:panel. Tout bouton ajouté = son texte dans la fiche.
 * Mobile : le bandeau passe à la ligne (flex-wrap) pour que tous les boutons restent visibles ; panneaux bornés à
 * la largeur de l'écran.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { liveSessionsApi } from '../../lib/api';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { SuiteDialog } from './SuiteDialog';
import { LIVE_ACTION_CLASS, LIVE_PANEL_CLASS, LIVE_PANEL_ACTIVE } from './liveStyles';
import { HelpHint } from '../../help/HelpHint';
import { PageHelpButton } from '../../help/PageHelpButton';
import { pageHint } from '../../help/pageHint';
import type { LiveSessionState, SpaceMember } from '@spok/shared';
import { SessionTimeline } from './SessionTimeline';
import { PresenterPanel } from './PresenterPanel';
import { AgendaPanel } from './AgendaPanel';
import { InviteesPanel } from './InviteesPanel';
import { ConfirmModal } from '../ConfirmModal';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';

type Panel = 'agenda' | 'timeline' | 'present' | 'presenters' | 'invitees' | null;

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
  const [suiteOpen, setSuiteOpen] = useState(false);
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
  const hint = (key: string) => pageHint('live-session', key);
  // Boutons à panneau (Préparation, Fil, Présenter, Présentateurs, Invités) : orange clair ; actions : orange vif
  const btn = (p: Panel) => `${LIVE_PANEL_CLASS}${panel === p ? ` ${LIVE_PANEL_ACTIVE}` : ''}`;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible'); }
  };

  const createSuite = (name: string) => run(async () => {
    const suite = await liveSessionsApi.createSuite(state.session.id, name);
    setSuiteOpen(false);
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
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-sm" data-help-zone="live-session:bar">
      <PageHelpButton pageKey="live-session" />
      <span data-tour="live-status" className={`font-medium ${isLive || status === 'PREPARED' ? 'text-orange-600' : 'text-muted-foreground'}`}>
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
      {/* Explications dans ce que chaque bouton ouvre (panneau, confirmation, fenêtre) — pas d'infobulle, sauf Démarrer */}
      <button className={btn('agenda')} data-tour="live-agenda" onClick={() => toggle('agenda')}>Préparation ({state.agenda.length})</button>
      <button className={btn('timeline')} data-tour="live-timeline" onClick={() => toggle('timeline')}>Fil</button>
      {canPresent && <button className={btn('present')} data-tour="live-present" onClick={() => toggle('present')}>Présenter</button>}
      {isHost && status !== 'ENDED' && <button className={btn('presenters')} data-tour="live-presenters" onClick={() => toggle('presenters')}>Présentateurs</button>}
      {isHost && <button className={btn('invitees')} data-tour="live-invitees" onClick={() => toggle('invitees')}>Invités</button>}
      {isHost && status === 'PREPARED' && (
        <HelpHint text={hint('start')} className="inline-flex">
          <button className={LIVE_ACTION_CLASS} data-tour="live-start" onClick={() => run(live.start)}>Démarrer la séance</button>
        </HelpHint>
      )}
      {isHost && isLive && <button className={LIVE_ACTION_CLASS} data-tour="live-end" onClick={() => setConfirmEnd(true)}>Terminer</button>}
      {isHost && status === 'ENDED' && !nextSession && (
        <button className={LIVE_ACTION_CLASS} data-tour="live-suite" onClick={() => { setError(null); setSuiteOpen(true); }}>Créer la suite</button>
      )}
      {suiteOpen && <SuiteDialog error={error} onCreate={createSuite} onClose={() => setSuiteOpen(false)} />}
      {panel && (
        <div className="absolute right-4 top-full z-30 mt-1 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background shadow-xl" data-help-zone="live-session:panel">
          {/* Explication du panneau ouvert (Préparation : affichée par AgendaPanel lui-même) */}
          {panel !== 'agenda' && <p className="px-3 pt-2 text-xs text-muted-foreground">{hint(panel)}</p>}
          {panel === 'agenda' && <AgendaPanel state={state} live={live} />}
          {panel === 'timeline' && (
            <SessionTimeline entries={state.entries} onOpenItem={(id) => { setPanel(null); onOpenItem(id); }} />
          )}
          {panel === 'present' && (
            <PresenterPanel sessionSpaceId={state.session.spaceId} onDisplay={(spaceId, itemId) => live.displayItem(itemId, spaceId)} />
          )}
          {panel === 'invitees' && (
            <InviteesPanel sessionId={state.session.id} parentSpaceId={state.session.parentSpaceId} ended={status === 'ENDED'} />
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
        message={hint('end') ?? ''}
        confirmLabel="Terminer"
        confirmVariant="destructive"
      />
    </div>
  );
}

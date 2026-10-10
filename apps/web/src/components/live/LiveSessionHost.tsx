/*
 * LiveSessionHost — hôte global de la séance active (monté une fois dans App.tsx, utilisateur connecté) : ouvre
 * l'UNIQUE flux SSE de l'onglet (useLiveSession(spaceId, { stream: true })), synchronise
 * useActiveLiveSessionStore.info et affiche LiveWindow sur toutes les pages tant que la séance est LIVE.
 * Vide la séance active si l'API répond en erreur (séance supprimée, accès retiré) ou sur « Quitter le direct ».
 * Rend aussi AddChildrenDialog (question « avec les sous-éléments ? »), quel que soit le statut de la séance.
 * Ne jamais ouvrir un second flux ailleurs (SpacePage lit le cache partagé ['live-session', spaceId]).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { useLiveSession } from '../../hooks/useLiveSession';
import { LiveWindow } from './LiveWindow';
import { AddChildrenDialog } from './AddChildrenDialog';

export function LiveSessionHost() {
  const spaceId = useActiveLiveSessionStore((s) => s.spaceId);
  const setInfo = useActiveLiveSessionStore((s) => s.setInfo);
  const clear = useActiveLiveSessionStore((s) => s.clear);
  const live = useLiveSession(spaceId ?? undefined, { stream: true });
  const navigate = useNavigate();
  const state = live.state;

  useEffect(() => {
    if (spaceId && live.isError) clear();
  }, [spaceId, live.isError, clear]);

  useEffect(() => {
    setInfo(state ? { sessionId: state.session.id, status: state.session.status, myRole: state.myRole, spaceName: state.spaceName } : null);
  }, [state?.session.id, state?.session.status, state?.myRole, state?.spaceName, setInfo]);

  return (
    <>
      <AddChildrenDialog />
      {spaceId && state?.session.status === 'LIVE' && (
        <LiveWindow
          state={state}
          live={live}
          onOpenItem={(itemId) => navigate(`/spaces/${spaceId}?item=${itemId}`)}
          onGoToSession={() => navigate(`/spaces/${spaceId}`)}
          onLeave={clear}
        />
      )}
    </>
  );
}

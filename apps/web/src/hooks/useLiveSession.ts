/*
 * useLiveSession(spaceId, { stream }) : état d'une séance live à partir de son espace (+ abonnement SSE si stream).
 * queryKey ['live-session', spaceId] ; state null = pas une séance (200 null) ; 403 = pas d'accès (isError, pas de retry).
 * UN SEUL flux par onglet : seul LiveSessionHost passe stream: true ; SpacePage et les autres lisent le cache partagé.
 * Les événements sont appliqués sur le cache (applyLiveEvent) ; à chaque reconnexion l'état complet est refetch.
 * Un display plus ancien que le courant (entry.createdAt) est ignoré — convergence si deux présentateurs.
 * Invalide ['items', spaceId] à chaque display/reveal : les copies apparaissent dans les vues de l'espace.
 * start()/end() refetch aussitôt ; les mutations de préparation posent la liste renvoyée dans le cache.
 * Préparation : complet pour l'animateur/les présentateurs, lignes déjà présentées pour les participants (filtré par l'API).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveAgendaItem, LiveEvent, LiveSessionState } from '@spok/shared';
import { liveSessionsApi } from '../lib/api';
import { openLiveStream } from '../lib/liveStream';

export function applyLiveEvent(state: LiveSessionState, event: LiveEvent): LiveSessionState {
  switch (event.type) {
    case 'display': {
      const entries = [...state.entries.filter((e) => e.id !== event.entry.id), event.entry]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (state.current && state.current.entry.createdAt > event.entry.createdAt) return { ...state, entries };
      return {
        ...state,
        session: { ...state.session, currentEntryId: event.entry.id },
        entries,
        current: { entry: event.entry, ...event.displayed },
      };
    }
    case 'reveal': {
      if (!state.current || state.current.item.id !== event.parentItemId) return state;
      if (state.current.children.some((c) => c.id === event.child.id)) return state;
      return { ...state, current: { ...state.current, children: [...state.current.children, event.child] } };
    }
    case 'join': return { ...state, entries: [...state.entries, event.entry] };
    case 'presence': return { ...state, presence: event.presence };
    case 'roles': return { ...state, roles: event.roles };
    case 'agenda': return { ...state, agenda: event.agenda };
    case 'started': return { ...state, session: { ...state.session, status: 'LIVE', liveAt: event.liveAt } };
    case 'ended': return { ...state, session: { ...state.session, status: 'ENDED', endedAt: event.endedAt } };
  }
}

export function useLiveSession(spaceId: string | undefined, options: { stream?: boolean } = {}) {
  const queryClient = useQueryClient();
  const key = ['live-session', spaceId];
  const { data: state, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => liveSessionsApi.getBySpace(spaceId!),
    enabled: !!spaceId,
    retry: false,
    staleTime: Infinity,
  });
  const sessionId = state?.session.id;

  useEffect(() => {
    if (!sessionId || !options.stream) return;
    let first = true;
    return openLiveStream(sessionId, {
      onOpen: () => { if (!first) refetch(); first = false; },
      onEvent: (event) => {
        queryClient.setQueryData<LiveSessionState>(['live-session', spaceId], (prev) => (prev ? applyLiveEvent(prev, event) : prev));
        // Changement de rôles : la préparation visible dépend du rôle (complète / déjà présentée) → état rechargé
        if (event.type === 'roles') refetch();
        // Démarrage / fin : le bouton « séances en cours » de l'en-tête se met à jour
        if (event.type === 'started' || event.type === 'ended') queryClient.invalidateQueries({ queryKey: ['live-sessions-ongoing'] });
        if (event.type === 'display' || event.type === 'reveal') {
          queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
          queryClient.invalidateQueries({ queryKey: ['live-pending', sessionId] });
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, options.stream]);

  const setAgenda = (agenda: LiveAgendaItem[]) =>
    queryClient.setQueryData<LiveSessionState>(key, (prev) => (prev ? { ...prev, agenda } : prev));

  return {
    state,
    isError,
    isLiveSpace: !!state && !isError,
    displayItem: async (sourceItemId: string, sourceSpaceId?: string) => {
      await liveSessionsApi.display(sessionId!, { sourceItemId, sourceSpaceId });
    },
    displayAgenda: async (agendaItemId: string) => { await liveSessionsApi.display(sessionId!, { agendaItemId }); },
    reveal: async (sourceItemId: string) => { await liveSessionsApi.reveal(sessionId!, sourceItemId); },
    start: async () => { await liveSessionsApi.start(sessionId!); await refetch(); queryClient.invalidateQueries({ queryKey: ['live-sessions-ongoing'] }); },
    end: async () => { await liveSessionsApi.end(sessionId!); await refetch(); queryClient.invalidateQueries({ queryKey: ['live-sessions-ongoing'] }); },
    setPresenters: async (userIds: string[]) => { await liveSessionsApi.setPresenters(sessionId!, userIds); },
    addToAgenda: async (sourceItemId: string, sourceSpaceId?: string) => {
      setAgenda(await liveSessionsApi.addToAgenda(sessionId!, sourceItemId, sourceSpaceId));
    },
    removeFromAgenda: async (agendaId: string) => { setAgenda(await liveSessionsApi.removeFromAgenda(sessionId!, agendaId)); },
    reorderAgenda: async (ids: string[]) => { setAgenda(await liveSessionsApi.reorderAgenda(sessionId!, ids)); },
  };
}

export type LiveSessionHandle = ReturnType<typeof useLiveSession>;

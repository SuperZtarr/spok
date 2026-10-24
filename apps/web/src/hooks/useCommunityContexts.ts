/* Contexte (FORUM / PROJECT / JDR / null) de chaque communauté, par id — pour la vue d'ouverture des espaces
 * (lib/spaceDefaultView.ts) hors de Layout. Même requête que la barre latérale (queryKey ['communities', userId |
 * 'public'], même queryFn) : aucun appel en plus, le cache est partagé. Ne pas changer la clé sans changer Layout.tsx. */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { communitiesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

export function useCommunityContexts(): Map<string, string | null> {
  const user = useAuthStore((s) => s.user);
  const { data: communities } = useQuery({
    queryKey: ['communities', user?.id || 'public'],
    queryFn: user ? communitiesApi.list : (() => communitiesApi.listPublic().then(list => list.map(c => ({ ...c, role: null, order: 0 })))) as typeof communitiesApi.list,
    staleTime: Infinity,
  });
  return useMemo(() => new Map((communities ?? []).map((c) => [c.id, c.context ?? null])), [communities]);
}

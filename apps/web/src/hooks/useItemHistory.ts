/* Hook TanStack Query : historique d'un élément pour sa fiche (règle item-history-members), paginé par date.
 * queryKey ['item-history', spaceId, itemId, version] — version = updatedAt de l'élément : tout enregistrement
 * (champs, contenus, contribution) change updatedAt, donc l'historique se relit sans invalidation explicite.
 * enabled : ne charger qu'à l'ouverture de la section (et jamais pour un visiteur anonyme, refusé par l'API). */
import { useInfiniteQuery } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';

export function useItemHistory(spaceId: string, itemId: string | undefined, version: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['item-history', spaceId, itemId, version],
    queryFn: ({ pageParam }) => itemsApi.history(spaceId, itemId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!itemId && !!spaceId,
  });
}

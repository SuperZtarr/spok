/*
 * Hook TanStack Query : parent, enfants et relations d'un item, avec leur espace (vue Loupe).
 * Params : spaceId (espace de l'item, pas forcément l'espace courant) et itemId ; sans l'un d'eux, aucune requête.
 * Usage : chargement à la demande de l'item zoomé. Cache de 30 s pour repasser d'un item à l'autre sans rappeler l'API.
 */
import { useQuery } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';

export function useItemLinks(spaceId: string | undefined, itemId: string | null) {
  return useQuery({
    queryKey: ['item-links', spaceId, itemId],
    queryFn: () => itemsApi.links(spaceId!, itemId!),
    enabled: !!spaceId && !!itemId,
    staleTime: 30_000,
  });
}

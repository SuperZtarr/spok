/*
 * useProcessNodes(spaceId) — positions des items sur le canevas de la vue Process (queryKey ['process-nodes', spaceId]).
 * place(itemId, x, y) : place ou déplace un item ; remove(itemId) : le renvoie dans le panneau « non placés »
 * (l'item n'est pas supprimé) ; placeMany(positions) : déplace plusieurs items placés en un appel (réorganisation).
 * Tous sont optimistes (cache mis à jour tout de suite, restauré en cas
 * d'échec, resynchronisé ensuite). Réservé à ProcessView ; ne pas appeler processApi directement depuis une vue.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processApi } from '../lib/api';
import type { ProcessPosition } from '../components/views/process-utils';

export function useProcessNodes(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['process-nodes', spaceId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => processApi.list(spaceId!),
    enabled: !!spaceId,
  });

  // Mise à jour optimiste commune : applique `update` au cache, renvoie l'état précédent pour le rollback
  const optimistic = async (update: (prev: ProcessPosition[]) => ProcessPosition[]) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData<ProcessPosition[]>(queryKey) ?? [];
    queryClient.setQueryData<ProcessPosition[]>(queryKey, update(previous));
    return { previous };
  };
  const rollback = (_err: unknown, _vars: unknown, ctx?: { previous: ProcessPosition[] }) => {
    if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
  };
  const settle = () => queryClient.invalidateQueries({ queryKey });

  const placeMutation = useMutation({
    mutationFn: (p: ProcessPosition) => processApi.place(spaceId!, p.itemId, p.x, p.y),
    onMutate: (p) => optimistic((prev) => [...prev.filter((q) => q.itemId !== p.itemId), p]),
    onError: rollback,
    onSettled: settle,
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => processApi.remove(spaceId!, itemId),
    onMutate: (itemId) => optimistic((prev) => prev.filter((q) => q.itemId !== itemId)),
    onError: rollback,
    onSettled: settle,
  });

  const placeManyMutation = useMutation({
    mutationFn: (batch: ProcessPosition[]) => processApi.placeMany(spaceId!, batch),
    onMutate: (batch) => optimistic((prev) => {
      const moved = new Map(batch.map((p) => [p.itemId, p]));
      return prev.map((p) => moved.get(p.itemId) ?? p);
    }),
    onError: rollback,
    onSettled: settle,
  });

  const { mutate: placeMutate } = placeMutation;
  const { mutate: removeMutate } = removeMutation;
  const { mutate: placeManyMutate } = placeManyMutation;
  const place = useCallback((itemId: string, x: number, y: number) => placeMutate({ itemId, x, y }), [placeMutate]);
  const remove = useCallback((itemId: string) => removeMutate(itemId), [removeMutate]);
  const placeMany = useCallback((batch: ProcessPosition[]) => placeManyMutate(batch), [placeManyMutate]);

  return { positions: data ?? [], isLoading, place, remove, placeMany };
}

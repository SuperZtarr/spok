/*
 * useProcessNodes(spaceId) — état partagé de la vue Process : positions des nœuds (queryKey ['process-nodes', spaceId])
 * et couloirs (['process-lanes', spaceId]).
 * Nœuds : place(itemId, x, y, laneId?) place ou déplace un item (laneId : couloir → x/y relatifs ; null → libre ;
 * absent → couloir inchangé) ; remove(itemId) le renvoie dans « Non placés » (l'item n'est pas supprimé) ;
 * placeMany(positions) déplace plusieurs nœuds en un appel (réorganisation).
 * Couloirs : addLane(itemId) fait d'un item un couloir (il cesse d'être un nœud) ; reorderLanes(ids) ;
 * removeLane(laneId, freed) supprime le couloir après avoir rendu ses membres libres aux coordonnées `freed`
 * (absolues, calculées par la vue pour qu'ils ne bougent pas à l'écran).
 * Écritures optimistes (cache mis à jour tout de suite, restauré en cas d'échec, resynchronisé ensuite).
 * Réservé à ProcessView ; ne pas appeler processApi directement depuis une vue.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processApi } from '../lib/api';
import type { ProcessLane, ProcessPosition } from '../components/views/process-utils';

/** Fusionne une position dans la liste ; laneId absent = couloir conservé. */
function merge(prev: ProcessPosition[], p: ProcessPosition): ProcessPosition[] {
  const old = prev.find((q) => q.itemId === p.itemId);
  const next = { ...p, laneId: p.laneId === undefined ? (old?.laneId ?? null) : p.laneId };
  return [...prev.filter((q) => q.itemId !== p.itemId), next];
}

export function useProcessNodes(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['process-nodes', spaceId];
  const lanesKey = ['process-lanes', spaceId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => processApi.list(spaceId!),
    enabled: !!spaceId,
  });
  const { data: lanesData } = useQuery({
    queryKey: lanesKey,
    queryFn: () => processApi.listLanes(spaceId!),
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
  const settleAll = () => Promise.all([
    queryClient.invalidateQueries({ queryKey }),
    queryClient.invalidateQueries({ queryKey: lanesKey }),
  ]);

  const placeMutation = useMutation({
    mutationFn: (p: ProcessPosition) => processApi.place(spaceId!, p.itemId, p.x, p.y, p.laneId),
    onMutate: (p) => optimistic((prev) => merge(prev, p)),
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
    onMutate: (batch) => optimistic((prev) => batch.reduce(merge, prev)),
    onError: rollback,
    onSettled: settle,
  });

  const addLaneMutation = useMutation({
    mutationFn: (itemId: string) => processApi.createLane(spaceId!, itemId),
    // L'item devient titre de couloir : il quitte tout de suite le canevas
    onMutate: (itemId) => optimistic((prev) => prev.filter((q) => q.itemId !== itemId)),
    onError: rollback,
    onSettled: settleAll,
  });

  const reorderLanesMutation = useMutation({
    mutationFn: (ids: string[]) => processApi.reorderLanes(spaceId!, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: lanesKey });
      const previous = queryClient.getQueryData<ProcessLane[]>(lanesKey) ?? [];
      queryClient.setQueryData<ProcessLane[]>(lanesKey, ids
        .map((id, position) => { const l = previous.find((x) => x.id === id); return l ? { ...l, position } : null; })
        .filter((l): l is ProcessLane => !!l));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx) queryClient.setQueryData(lanesKey, ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: lanesKey }),
  });

  const removeLaneMutation = useMutation({
    mutationFn: async ({ laneId, freed }: { laneId: string; freed: ProcessPosition[] }) => {
      if (freed.length) await processApi.placeMany(spaceId!, freed);
      await processApi.deleteLane(spaceId!, laneId);
    },
    onMutate: ({ freed }) => optimistic((prev) => freed.reduce(merge, prev)),
    onError: rollback,
    onSettled: settleAll,
  });

  const { mutate: placeMutate } = placeMutation;
  const { mutate: removeMutate } = removeMutation;
  const { mutate: placeManyMutate } = placeManyMutation;
  const { mutate: addLaneMutate } = addLaneMutation;
  const { mutate: reorderLanesMutate } = reorderLanesMutation;
  const { mutate: removeLaneMutate } = removeLaneMutation;
  const place = useCallback((itemId: string, x: number, y: number, laneId?: string | null) => placeMutate({ itemId, x, y, laneId }), [placeMutate]);
  const remove = useCallback((itemId: string) => removeMutate(itemId), [removeMutate]);
  const placeMany = useCallback((batch: ProcessPosition[]) => placeManyMutate(batch), [placeManyMutate]);
  const addLane = useCallback((itemId: string) => addLaneMutate(itemId), [addLaneMutate]);
  const reorderLanes = useCallback((ids: string[]) => reorderLanesMutate(ids), [reorderLanesMutate]);
  const removeLane = useCallback((laneId: string, freed: ProcessPosition[]) => removeLaneMutate({ laneId, freed }), [removeLaneMutate]);

  return {
    positions: data ?? [], lanes: lanesData ?? [], isLoading,
    place, remove, placeMany, addLane, reorderLanes, removeLane,
  };
}

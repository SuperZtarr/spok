/*
 * useProcessCanvas(spaceId, processId) — état du canevas d'un élément Process (type PROCESS, 2026-11-21) : vue résolue
 * par l'API (ProcessCanvasView sous queryKey ['process', spaceId, processId] : places, couloirs, relations entre
 * éléments montrés). Remplace useProcessNodes (process unique de l'espace).
 * Places : move(itemId, x, y, laneId?) déplace une place existante (laneId : couloir → x/y relatifs ; null → libre ;
 * absent → inchangé) ; placeNew(itemId, x, y, laneId, confirm?) pose un nouvel élément — promesse rejetée avec l'ApiError
 * (409 LESS_VISIBLE à confirmer par l'appelant, IS_LANE, 403) ; remove(itemId) retire du process (rien n'est supprimé) ;
 * placeMany(positions) enregistre plusieurs places existantes en un appel (Réorganiser).
 * Couloirs : addLane(itemId, confirm?) (promesse, mêmes erreurs) ; reorderLanes(ids) ; moveLanes([{ id, x, y }])
 * (x/y null = pile) ; removeLane(laneId, freed) rend d'abord ses membres libres aux coordonnées `freed` (absolues).
 * Relations : createRelation / updateRelation / deleteRelation passent par l'espace de l'élément source (connu seulement
 * si le lecteur peut l'ouvrir, sourceSpaceId) — sans lui, rien n'est envoyé.
 * Écritures optimistes pour les déplacements (cache mis à jour tout de suite, restauré en cas d'échec, resynchronisé).
 * Réservé à ProcessView ; ne pas appeler processApi directement depuis une vue.
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProcessCanvasView } from '@spok/shared';
import { itemsApi, processApi } from '../lib/api';

export type CanvasPosition = { itemId: string; x: number; y: number; laneId?: string | null };
type LaneMove = { id: string; x: number | null; y: number | null };

/** Applique des positions aux places existantes ; laneId absent = couloir conservé. */
function applyPositions(view: ProcessCanvasView, positions: CanvasPosition[]): ProcessCanvasView {
  const byId = new Map(positions.map((p) => [p.itemId, p]));
  return {
    ...view,
    nodes: view.nodes.map((n) => {
      const p = byId.get(n.itemId);
      return p ? { ...n, x: p.x, y: p.y, laneId: p.laneId === undefined ? n.laneId : p.laneId } : n;
    }),
  };
}

export function useProcessCanvas(spaceId: string | undefined, processId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['process', spaceId, processId];
  const enabled = !!spaceId && !!processId;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => processApi.get(spaceId!, processId!),
    enabled,
  });

  // Mise à jour optimiste commune : applique `update` au cache, renvoie l'état précédent pour le rollback
  const optimistic = async (update: (prev: ProcessCanvasView) => ProcessCanvasView) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData<ProcessCanvasView>(queryKey);
    if (previous) queryClient.setQueryData<ProcessCanvasView>(queryKey, update(previous));
    return { previous };
  };
  const rollback = (_err: unknown, _vars: unknown, ctx?: { previous?: ProcessCanvasView }) => {
    if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
  };
  const settle = () => queryClient.invalidateQueries({ queryKey });

  const moveMutation = useMutation({
    mutationFn: (p: CanvasPosition) => processApi.place(spaceId!, processId!, p.itemId, { x: p.x, y: p.y, ...(p.laneId === undefined ? {} : { laneId: p.laneId }) }),
    onMutate: (p) => optimistic((prev) => applyPositions(prev, [p])),
    onError: rollback,
    onSettled: settle,
  });

  const placeNewMutation = useMutation({
    mutationFn: (p: CanvasPosition & { confirmLessVisible?: boolean }) =>
      processApi.place(spaceId!, processId!, p.itemId, { x: p.x, y: p.y, laneId: p.laneId ?? null, confirmLessVisible: p.confirmLessVisible }),
    onSettled: settle,
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => processApi.remove(spaceId!, processId!, itemId),
    onMutate: (itemId) => optimistic((prev) => ({ ...prev, nodes: prev.nodes.filter((n) => n.itemId !== itemId) })),
    onError: rollback,
    onSettled: settle,
  });

  const placeManyMutation = useMutation({
    mutationFn: (batch: CanvasPosition[]) => processApi.placeMany(spaceId!, processId!, batch),
    onMutate: (batch) => optimistic((prev) => applyPositions(prev, batch)),
    onError: rollback,
    onSettled: settle,
  });

  const addLaneMutation = useMutation({
    mutationFn: ({ itemId, confirmLessVisible }: { itemId: string; confirmLessVisible?: boolean }) =>
      processApi.createLane(spaceId!, processId!, itemId, confirmLessVisible),
    onSettled: settle,
  });

  const reorderLanesMutation = useMutation({
    mutationFn: (ids: string[]) => processApi.reorderLanes(spaceId!, processId!, ids),
    onMutate: (ids) => optimistic((prev) => ({
      ...prev,
      lanes: prev.lanes.map((l) => ({ ...l, position: ids.indexOf(l.id) < 0 ? l.position : ids.indexOf(l.id) })),
    })),
    onError: rollback,
    onSettled: settle,
  });

  const moveLanesMutation = useMutation({
    mutationFn: (batch: LaneMove[]) => processApi.layoutLanes(spaceId!, processId!, batch),
    onMutate: (batch) => {
      const moved = new Map(batch.map((b) => [b.id, b]));
      return optimistic((prev) => ({
        ...prev,
        lanes: prev.lanes.map((l) => { const m = moved.get(l.id); return m ? { ...l, x: m.x, y: m.y } : l; }),
      }));
    },
    onError: rollback,
    onSettled: settle,
  });

  const removeLaneMutation = useMutation({
    mutationFn: async ({ laneId, freed }: { laneId: string; freed: CanvasPosition[] }) => {
      if (freed.length) await processApi.placeMany(spaceId!, processId!, freed);
      await processApi.deleteLane(spaceId!, processId!, laneId);
    },
    onMutate: ({ laneId, freed }) => optimistic((prev) => ({
      ...applyPositions(prev, freed),
      lanes: prev.lanes.filter((l) => l.id !== laneId),
    })),
    onError: rollback,
    onSettled: settle,
  });

  // Relations : la liste des éléments de l'espace (vues, fiche) en dépend aussi
  const settleRelations = () => Promise.all([settle(), queryClient.invalidateQueries({ queryKey: ['items'] })]);
  const createRelationMutation = useMutation({
    mutationFn: (r: { sourceSpaceId: string; fromId: string; toId: string; type: string; label?: string }) =>
      itemsApi.createRelation(r.sourceSpaceId, r.fromId, { toItemId: r.toId, type: r.type, label: r.label }),
    onSettled: settleRelations,
  });
  const updateRelationMutation = useMutation({
    mutationFn: (r: { sourceSpaceId: string; itemId: string; relationId: string; data: { type?: string; label?: string | null } }) =>
      itemsApi.updateRelation(r.sourceSpaceId, r.itemId, r.relationId, r.data),
    onSettled: settleRelations,
  });
  const deleteRelationMutation = useMutation({
    mutationFn: (r: { sourceSpaceId: string; itemId: string; relationId: string }) =>
      itemsApi.deleteRelation(r.sourceSpaceId, r.itemId, r.relationId),
    onSettled: settleRelations,
  });

  const { mutate: moveMutate } = moveMutation;
  const { mutateAsync: placeNewAsync } = placeNewMutation;
  const { mutate: removeMutate } = removeMutation;
  const { mutate: placeManyMutate } = placeManyMutation;
  const { mutateAsync: addLaneAsync } = addLaneMutation;
  const { mutate: reorderLanesMutate } = reorderLanesMutation;
  const { mutate: moveLanesMutate } = moveLanesMutation;
  const { mutate: removeLaneMutate } = removeLaneMutation;

  return {
    view: data,
    isLoading,
    isError,
    move: useCallback((itemId: string, x: number, y: number, laneId?: string | null) => moveMutate({ itemId, x, y, laneId }), [moveMutate]),
    placeNew: useCallback((itemId: string, x: number, y: number, laneId: string | null, confirmLessVisible?: boolean) =>
      placeNewAsync({ itemId, x, y, laneId, confirmLessVisible }), [placeNewAsync]),
    remove: useCallback((itemId: string) => removeMutate(itemId), [removeMutate]),
    placeMany: useCallback((batch: CanvasPosition[]) => placeManyMutate(batch), [placeManyMutate]),
    addLane: useCallback((itemId: string, confirmLessVisible?: boolean) => addLaneAsync({ itemId, confirmLessVisible }), [addLaneAsync]),
    reorderLanes: useCallback((ids: string[]) => reorderLanesMutate(ids), [reorderLanesMutate]),
    moveLanes: useCallback((batch: LaneMove[]) => moveLanesMutate(batch), [moveLanesMutate]),
    removeLane: useCallback((laneId: string, freed: CanvasPosition[]) => removeLaneMutate({ laneId, freed }), [removeLaneMutate]),
    createRelation: createRelationMutation.mutate,
    updateRelation: updateRelationMutation.mutate,
    deleteRelation: deleteRelationMutation.mutate,
  };
}

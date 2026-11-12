/**
 * Hook centralisant les actions mutatives de SpacePage (update, move, relations,
 * suppression, fusion, conversion, propagation de statut, déplacement cross-space).
 * Toute mutation qui touche des champs lisibles immédiatement après coup (ex: dates
 * mises à jour par drag dans le Gantt puis relues par ItemEditModal) doit appliquer
 * une mise à jour optimiste du cache React Query — sinon l'UI lit des données stales
 * pendant la fenêtre réseau entre le clic et la réponse du serveur.
 * handleOpen(id, mode) : navigation vers l'item dans son espace, mode Afficher porté par ?mode=lecture.
 * handleMove : un dépôt refusé par l'API (parent d'un autre espace, cycle) est signalé par window.alert (pas de toast dans l'app).
 * handleAbsorbChildren : même signalement d'un refus (plafond de contenus du parent dépassé, lot 5 contenus multiples).
 * statuses : statuts de la communauté (référentiels). handleInlineUpdate (Kanban, menu ⋯, listes) applique au changement de
 * statut les mêmes règles de dates que la fiche via lib/statusChange.ts (« Non défini » efface début et fin) ; annuler la
 * propagation rétablit statut et dates d'avant.
 * handleSetTags(id, tags) (vue Tags, 2026-11-11) : enregistre la liste complète des tags (tagIds), affichage optimiste,
 * refus signalé par window.alert puis relecture. handleBulkTags(itemIds, add, removeIds) : même chose pour plusieurs
 * éléments en une requête (POST bulk-tags).
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Item, ItemType, StatusConfig, Tag } from '@spok/shared';
import { itemsApi } from '../lib/api';
import { statusChangeFields } from '../lib/statusChange';
import { itemUrl, type ItemOpenMode } from '../lib/itemOpenMode';

// Types for modal states
export interface DeletingItem {
  id: string;
  title: string;
  type: string;
  childCount: number;
  contributionCount: number;
  description?: string | null;
  status?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  assignedToName?: string | null;
  tags?: Array<{ name: string; color?: string | null }>;
}

export interface ConvertingItem {
  id: string;
  title: string;
  childCount: number;
}

export interface PendingStatusPropagation {
  itemId: string;
  itemTitle: string;
  status: string;
  childCount: number;
  previousStatus: string | null;
  /** Dates d'avant le changement, rétablies si l'utilisateur annule */
  previousStartDate: string | null;
  previousEndDate: string | null;
}

export interface PendingCrossSpaceMove {
  itemId: string;
  itemTitle: string;
  sourceSpaceId: string;
  targetSpaceId: string;
  targetSpaceName: string;
  childCount: number;
  updates?: { status?: string; type?: ItemType };
}

interface UseSpaceActionsOptions {
  spaceId: string | undefined;
  allItems: Item[];
  communityId?: string | null;
  communitySpaces?: Array<{ id: string; name: string }>;
  /** Statuts de la communauté (sens terminé / annulé des statuts personnalisés) */
  statuses?: StatusConfig[];
}

// Count all descendants recursively
function countDescendants(allItems: Item[], parentId: string): number {
  const children = allItems.filter((i) => i.parentId === parentId);
  return children.reduce((acc, child) => acc + 1 + countDescendants(allItems, child.id), 0);
}

export function useSpaceActions({ spaceId, allItems, communityId, communitySpaces, statuses }: UseSpaceActionsOptions) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Modal states
  const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);
  const [convertingItem, setConvertingItem] = useState<ConvertingItem | null>(null);
  const [pendingCrossSpaceMove, setPendingCrossSpaceMove] = useState<PendingCrossSpaceMove | null>(null);
  const [mergingItemId, setMergingItemId] = useState<string | null>(null);
  const [pendingStatusPropagation, setPendingStatusPropagation] = useState<PendingStatusPropagation | null>(null);

  // Resolve an item's actual spaceId (portal items belong to different spaces)
  const resolveItemSpaceId = useCallback((itemId: string): string => {
    const item = allItems.find((i) => i.id === itemId);
    return item?.spaceId || spaceId || '';
  }, [allItems, spaceId]);

  // --- Mutations ---

  const deleteItemMutation = useMutation({
    mutationFn: ({ id, itemSpaceId, deleteChildren }: { id: string; itemSpaceId: string; deleteChildren?: boolean }) =>
      itemsApi.delete(itemSpaceId, id, { deleteChildren }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs', spaceId] });
      if (variables.itemSpaceId !== spaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', variables.itemSpaceId] });
        queryClient.invalidateQueries({ queryKey: ['auditLogs', variables.itemSpaceId] });
      }
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, itemSpaceId, data }: { id: string; itemSpaceId: string; data: { status?: string | null; type?: ItemType; startDate?: string | null; endDate?: string | null; dueDate?: string | null; updatedAt?: string; propagateToChildren?: boolean } }) =>
      itemsApi.update(itemSpaceId, id, data),
    // Optimistic update : applique startDate/endDate/dueDate au cache avant la réponse serveur.
    // Évite qu'ItemEditModal lise des dates stales si ouverte juste après un drag dans le Gantt,
    // et que le losange d'échéance du Gantt revienne à son ancienne place pendant la requête.
    onMutate: ({ id, data }) => {
      if (data.startDate === undefined && data.endDate === undefined && data.dueDate === undefined) return;
      queryClient.setQueriesData({ queryKey: ['items'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((item: any) =>
            item.id === id
              ? {
                  ...item,
                  ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
                  ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
                  ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
                }
              : item
          ),
        };
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      if (variables.itemSpaceId !== spaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', variables.itemSpaceId] });
      }
    },
    onError: (error) => {
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 409) {
        queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      }
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: ({ id, itemSpaceId, parentId, position }: { id: string; itemSpaceId: string; parentId?: string | null; position: number }) =>
      itemsApi.move(itemSpaceId, id, { parentId, position }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      if (variables.itemSpaceId !== spaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', variables.itemSpaceId] });
      }
    },
    // Dépôt refusé (parent d'un autre espace, cycle) : l'élément reprend sa place et l'API dit pourquoi
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      window.alert(error instanceof Error ? error.message : 'Déplacement impossible');
    },
  });

  const createRelationMutation = useMutation({
    mutationFn: ({ fromItemId, itemSpaceId, toItemId, type, label }: { fromItemId: string; itemSpaceId: string; toItemId: string; type: string; label?: string }) =>
      itemsApi.createRelation(itemSpaceId, fromItemId, { toItemId, type, label }),
    onSuccess: (newRelation, variables) => {
      if (newRelation) {
        queryClient.setQueriesData({ queryKey: ['items', spaceId] }, (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((item: any) =>
              item.id === variables.fromItemId
                ? { ...item, relationsFrom: [...(item.relationsFrom || []), newRelation] }
                : item
            ),
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, relationId }: { itemId: string; itemSpaceId: string; relationId: string }) =>
      itemsApi.deleteRelation(itemSpaceId, itemId, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const cascadeShiftMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, deltaDays, dependentIds }: { itemId: string; itemSpaceId: string; deltaDays: number; dependentIds: string[] }) =>
      itemsApi.cascadeShift(itemSpaceId, itemId, { deltaDays, dependentIds }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      // Un dépendant peut être dans un autre espace (relation drives cross-space) — invalider
      // sa requête ['item', <son espace>, id] sans connaître cet espace à l'avance.
      for (const dependentId of variables.dependentIds) {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'item' && query.queryKey[2] === dependentId });
      }
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, relationId, data }: { itemId: string; itemSpaceId: string; relationId: string; data: { type?: string; label?: string | null } }) =>
      itemsApi.updateRelation(itemSpaceId, itemId, relationId, data),
    onSuccess: (_, variables) => {
      // Patch optimiste : met à jour le label/type de la relation dans le cache sans attendre le refetch
      const patchCache = (queryKey: unknown[]) => {
        queryClient.setQueriesData({ queryKey }, (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((item: any) => {
              if (!item.relationsFrom) return item;
              const hasRel = item.relationsFrom.some((r: any) => r.id === variables.relationId);
              if (!hasRel) return item;
              return {
                ...item,
                relationsFrom: item.relationsFrom.map((r: any) =>
                  r.id === variables.relationId ? { ...r, ...variables.data } : r
                ),
              };
            }),
          };
        });
      };
      patchCache(['items', spaceId]);
      if (variables.itemSpaceId !== spaceId) patchCache(['items', variables.itemSpaceId]);
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      if (variables.itemSpaceId !== spaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', variables.itemSpaceId] });
      }
    },
    onError: (error) => console.error('[updateRelation] error:', error),
  });

  const convertToSpaceMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, spaceName }: { itemId: string; itemSpaceId: string; spaceName: string }) =>
      itemsApi.convertToSpace(itemSpaceId, itemId, {
        spaceName,
        communityId: communityId || undefined,
        parentSpaceId: spaceId || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      setConvertingItem(null);
      navigate(`/spaces/${result.space.id}`);
    },
  });

  // --- Action handlers ---

  const handleDelete = useCallback((id: string) => {
    const item = allItems.find((i) => i.id === id) as (Item & { contributionCount?: number; assignedTo?: { name: string } | null }) | undefined;
    setDeletingItem({
      id,
      title: item?.title || 'cet élément',
      type: item?.type || 'UNDEFINED',
      childCount: countDescendants(allItems, id),
      contributionCount: (item as any)?.contributionCount || 0,
      description: item?.description,
      status: item?.status,
      priority: item?.priority,
      dueDate: item?.dueDate,
      startDate: item?.startDate,
      endDate: item?.endDate,
      assignedToName: item?.assignedTo?.name || item?.assignedToName || null,
      tags: item?.tags?.map(t => ({ name: t.name, color: t.color })),
    });
  }, [allItems]);

  const confirmDelete = useCallback((options: { deleteChildren: boolean }) => {
    if (deletingItem) {
      const itemSpaceId = resolveItemSpaceId(deletingItem.id);
      deleteItemMutation.mutate({ id: deletingItem.id, itemSpaceId, deleteChildren: options.deleteChildren });
      setDeletingItem(null);
    }
  }, [deletingItem, deleteItemMutation, resolveItemSpaceId]);

  const handleConvertToSpace = useCallback((id: string) => {
    const item = allItems.find((i) => i.id === id);
    setConvertingItem({
      id,
      title: item?.title || 'cet élément',
      childCount: countDescendants(allItems, id),
    });
  }, [allItems]);

  const confirmConvertToSpace = useCallback((spaceName: string) => {
    if (convertingItem) {
      const itemSpaceId = resolveItemSpaceId(convertingItem.id);
      convertToSpaceMutation.mutate({ itemId: convertingItem.id, itemSpaceId, spaceName });
    }
  }, [convertingItem, resolveItemSpaceId, convertToSpaceMutation]);

  const handleInlineUpdate = useCallback((id: string, data: { status?: string; type?: ItemType; startDate?: string | null; endDate?: string | null; dueDate?: string | null; assignedToId?: string | null; assignedToName?: string | null; priority?: number | null }) => {
    const itemSpaceId = resolveItemSpaceId(id);
    const item = allItems.find(i => i.id === id);
    // Statut changé : mêmes règles de dates que la fiche (lib/statusChange.ts) — « Non défini » efface début et fin,
    // un statut qui ferme remplit la fin vide, tout statut remplit le début vide
    const updates: Omit<typeof data, 'status'> & { status?: string | null } = data.status !== undefined
      ? { ...data, ...statusChangeFields(data.status, { startDate: item?.startDate, endDate: item?.endDate }, statuses) }
      : { ...data };

    updateItemMutation.mutate({ id, itemSpaceId, data: updates });

    // If status changed on an item with children, propose propagation
    if (data.status !== undefined) {
      const childCount = countDescendants(allItems, id);
      if (childCount > 0) {
        setPendingStatusPropagation({
          itemId: id,
          itemTitle: item?.title || 'cet élément',
          status: updates.status ?? '',
          childCount,
          previousStatus: item?.status ?? null,
          previousStartDate: item?.startDate ?? null,
          previousEndDate: item?.endDate ?? null,
        });
      }
    }
  }, [resolveItemSpaceId, updateItemMutation, allItems, statuses]);

  // Tags d'un élément (vue Tags, 2026-11-11) : liste complète enregistrée (tagIds seuls, permis aussi sur une copie de
  // séance verrouillée) ; affichage mis à jour avant la réponse, rétabli par relecture et signalé en cas de refus.
  const setTagsMutation = useMutation({
    mutationFn: ({ id, itemSpaceId, tags }: { id: string; itemSpaceId: string; tags: Tag[] }) =>
      itemsApi.update(itemSpaceId, id, { tagIds: tags.map((t) => t.id) }),
    onMutate: ({ id, tags }) => {
      queryClient.setQueriesData({ queryKey: ['items'] }, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((item: any) => (item.id === id ? { ...item, tags } : item)) };
      });
    },
    onError: (error) => {
      window.alert(`Tags non enregistrés : ${error instanceof Error ? error.message : 'erreur'}`);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['item', variables.itemSpaceId, variables.id] });
      if (variables.itemSpaceId !== spaceId) queryClient.invalidateQueries({ queryKey: ['items', variables.itemSpaceId] });
    },
  });

  const handleSetTags = useCallback((id: string, tags: Tag[]) => {
    setTagsMutation.mutate({ id, itemSpaceId: resolveItemSpaceId(id), tags });
  }, [resolveItemSpaceId, setTagsMutation]);

  // Tags de plusieurs éléments (sélection de la vue Tags) : une seule requête (POST bulk-tags), affichage optimiste
  const bulkTagsMutation = useMutation({
    mutationFn: ({ itemIds, add, removeIds }: { itemIds: string[]; add: Tag[]; removeIds: string[] }) =>
      itemsApi.bulkTags(spaceId!, { itemIds, addTagIds: add.map((t) => t.id), removeTagIds: removeIds }),
    onMutate: ({ itemIds, add, removeIds }) => {
      const ids = new Set(itemIds);
      queryClient.setQueriesData({ queryKey: ['items'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((item: any) => {
            if (!ids.has(item.id)) return item;
            const kept = (item.tags ?? []).filter((t: Tag) => !removeIds.includes(t.id));
            return { ...item, tags: [...kept, ...add.filter((t) => !kept.some((k: Tag) => k.id === t.id))] };
          }),
        };
      });
    },
    onError: (error) => {
      window.alert(`Tags non enregistrés : ${error instanceof Error ? error.message : 'erreur'}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item'] });
    },
  });

  const handleBulkTags = useCallback((itemIds: string[], add: Tag[], removeIds: string[] = []) => {
    if (itemIds.length === 0 || (add.length === 0 && removeIds.length === 0)) return;
    bulkTagsMutation.mutate({ itemIds, add, removeIds });
  }, [bulkTagsMutation]);

  const handleMove = useCallback((id: string, parentId: string | null, position: number) => {
    const itemSpaceId = resolveItemSpaceId(id);
    moveItemMutation.mutate({ id, itemSpaceId, parentId, position });
  }, [resolveItemSpaceId, moveItemMutation]);

  const executeCrossSpaceMove = useCallback(async (itemId: string, sourceSpaceId: string, targetSpaceId: string, includeChildren: boolean, updates?: { status?: string; type?: ItemType }) => {
    try {
      await itemsApi.bulkMove(sourceSpaceId, { itemIds: [itemId], targetSpaceId, includeChildren });
      if (updates) {
        await itemsApi.update(targetSpaceId, itemId, updates);
      }
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    } catch (e) {
      console.error('Failed to move item to space:', e);
    }
  }, [queryClient, spaceId]);

  const handleMoveItemToSpace = useCallback((itemId: string, sourceSpaceId: string, targetSpaceId: string, updates?: { status?: string; type?: ItemType }) => {
    const item = allItems.find((i) => i.id === itemId);
    const childCount = countDescendants(allItems, itemId);

    if (childCount > 0) {
      const targetSpaceName = communitySpaces?.find(s => s.id === targetSpaceId)?.name || 'l\'espace cible';
      setPendingCrossSpaceMove({
        itemId,
        itemTitle: item?.title || 'cet élément',
        sourceSpaceId,
        targetSpaceId,
        targetSpaceName,
        childCount,
        updates,
      });
    } else {
      executeCrossSpaceMove(itemId, sourceSpaceId, targetSpaceId, true, updates);
    }
  }, [allItems, communitySpaces, executeCrossSpaceMove]);

  const handleCreateRelation = useCallback((fromItemId: string, toItemId: string, type: string, label?: string) => {
    const itemSpaceId = resolveItemSpaceId(fromItemId);
    createRelationMutation.mutate({ fromItemId, itemSpaceId, toItemId, type, label });
  }, [resolveItemSpaceId, createRelationMutation]);

  const handleDeleteRelation = useCallback((itemId: string, relationId: string) => {
    const itemSpaceId = resolveItemSpaceId(itemId);
    deleteRelationMutation.mutate({ itemId, itemSpaceId, relationId });
  }, [resolveItemSpaceId, deleteRelationMutation]);

  const handleCascadeShift = useCallback((itemId: string, deltaDays: number, dependentIds: string[]) => {
    const itemSpaceId = resolveItemSpaceId(itemId);
    cascadeShiftMutation.mutate({ itemId, itemSpaceId, deltaDays, dependentIds });
  }, [resolveItemSpaceId, cascadeShiftMutation]);

  const handleUpdateRelation = useCallback((itemId: string, relationId: string, data: { type?: string; label?: string | null }) => {
    const itemSpaceId = resolveItemSpaceId(itemId);
    updateRelationMutation.mutate({ itemId, itemSpaceId, relationId, data });
  }, [resolveItemSpaceId, updateRelationMutation]);

  // --- Status propagation ---

  const confirmStatusPropagation = useCallback(() => {
    if (pendingStatusPropagation) {
      const itemSpaceId = resolveItemSpaceId(pendingStatusPropagation.itemId);
      updateItemMutation.mutate({
        id: pendingStatusPropagation.itemId,
        itemSpaceId,
        data: { status: pendingStatusPropagation.status, propagateToChildren: true },
      });
      setPendingStatusPropagation(null);
    }
  }, [pendingStatusPropagation, resolveItemSpaceId, updateItemMutation]);

  const cancelStatusPropagation = useCallback(() => {
    if (pendingStatusPropagation) {
      const itemSpaceId = resolveItemSpaceId(pendingStatusPropagation.itemId);
      updateItemMutation.mutate({
        id: pendingStatusPropagation.itemId,
        itemSpaceId,
        // Annuler = revenir à l'état d'avant, statut vide et dates comprises (remplies ou effacées par le changement)
        data: {
          status: pendingStatusPropagation.previousStatus,
          startDate: pendingStatusPropagation.previousStartDate,
          endDate: pendingStatusPropagation.previousEndDate,
        },
      });
      setPendingStatusPropagation(null);
    }
  }, [pendingStatusPropagation, resolveItemSpaceId, updateItemMutation]);

  // --- Merge ---

  const handleMerge = useCallback((id: string) => {
    setMergingItemId(id);
  }, []);

  const absorbChildrenMutation = useMutation({
    mutationFn: ({ id, itemSpaceId }: { id: string; itemSpaceId: string }) =>
      itemsApi.absorbChildren(itemSpaceId, id),
    onSuccess: (_, { id, itemSpaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      // Invalider aussi l'item lui-même pour que l'ouverture dans la modale
      // reflète immédiatement la description compilée
      queryClient.invalidateQueries({ queryKey: ['item', itemSpaceId, id] });
    },
    // Refus de l'API (plafond de contenus du parent dépassé, copie verrouillée…) : message de l'API, comme handleMove
    onError: (error) => window.alert(error instanceof Error ? error.message : 'Absorption impossible'),
  });

  const handleAbsorbChildren = useCallback((id: string) => {
    const itemSpaceId = resolveItemSpaceId(id);
    absorbChildrenMutation.mutate({ id, itemSpaceId });
  }, [resolveItemSpaceId, absorbChildrenMutation]);

  const splitMutation = useMutation({
    mutationFn: ({ id, itemSpaceId }: { id: string; itemSpaceId: string }) =>
      itemsApi.splitByHeadings(itemSpaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const handleSplitDescription = useCallback((id: string) => {
    const itemSpaceId = resolveItemSpaceId(id);
    splitMutation.mutate({ id, itemSpaceId });
  }, [resolveItemSpaceId, splitMutation]);

  // Ouvre l'item dans son propre espace ; le mode (Afficher = 'read') passe dans l'adresse (itemOpenMode.ts)
  const handleOpen = useCallback((id: string, mode?: ItemOpenMode) => {
    navigate(itemUrl(resolveItemSpaceId(id), id, mode));
  }, [resolveItemSpaceId, navigate]);

  const handleOpenInNewTab = useCallback((id: string) => {
    window.open(itemUrl(resolveItemSpaceId(id), id), '_blank');
  }, [resolveItemSpaceId]);

  const reorderMutation = useMutation({
    mutationFn: ({ targetSpaceId, groups }: { targetSpaceId: string; groups: { parentId: string | null; itemIds: string[] }[] }) =>
      itemsApi.reorder(targetSpaceId, groups),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const handleReorder = useCallback((targetSpaceId: string, groups: { parentId: string | null; itemIds: string[] }[]) => {
    reorderMutation.mutate({ targetSpaceId, groups });
  }, [reorderMutation]);

  return {
    // Delete flow
    handleDelete,
    confirmDelete,
    deletingItem,
    setDeletingItem,
    // Convert flow
    handleConvertToSpace,
    confirmConvertToSpace,
    convertingItem,
    setConvertingItem,
    convertToSpacePending: convertToSpaceMutation.isPending,
    // Inline updates
    handleInlineUpdate,
    handleSetTags,
    handleBulkTags,
    // Move
    handleMove,
    moveItemMutation,
    // Cross-space move flow
    handleMoveItemToSpace,
    executeCrossSpaceMove,
    pendingCrossSpaceMove,
    setPendingCrossSpaceMove,
    // Relations
    handleCreateRelation,
    handleDeleteRelation,
    handleUpdateRelation,
    handleCascadeShift,
    // Status propagation
    pendingStatusPropagation,
    setPendingStatusPropagation,
    confirmStatusPropagation,
    cancelStatusPropagation,
    // Merge
    handleMerge,
    mergingItemId,
    setMergingItemId,
    handleAbsorbChildren,
    // Split
    handleSplitDescription,
    // Open
    handleOpen,
    handleOpenInNewTab,
    // Reorder
    handleReorder,
  };
}

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Item, ItemType } from '@spok/shared';
import { itemsApi } from '../lib/api';

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
}

// Count all descendants recursively
function countDescendants(allItems: Item[], parentId: string): number {
  const children = allItems.filter((i) => i.parentId === parentId);
  return children.reduce((acc, child) => acc + 1 + countDescendants(allItems, child.id), 0);
}

export function useSpaceActions({ spaceId, allItems, communityId, communitySpaces }: UseSpaceActionsOptions) {
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
    mutationFn: ({ id, itemSpaceId, data }: { id: string; itemSpaceId: string; data: { status?: string; type?: ItemType; startDate?: string | null; endDate?: string | null; updatedAt?: string; propagateToChildren?: boolean } }) =>
      itemsApi.update(itemSpaceId, id, data),
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
  });

  const createRelationMutation = useMutation({
    mutationFn: ({ fromItemId, itemSpaceId, toItemId, type, label }: { fromItemId: string; itemSpaceId: string; toItemId: string; type: string; label?: string }) =>
      itemsApi.createRelation(itemSpaceId, fromItemId, { toItemId, type, label }),
    onSuccess: () => {
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

  const updateRelationMutation = useMutation({
    mutationFn: ({ itemId, itemSpaceId, relationId, data }: { itemId: string; itemSpaceId: string; relationId: string; data: { type?: string; label?: string | null } }) =>
      itemsApi.updateRelation(itemSpaceId, itemId, relationId, data),
    onSuccess: (_, variables) => {
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
      type: item?.type || 'NOTE',
      childCount: countDescendants(allItems, id),
      contributionCount: (item as any)?.contributionCount || 0,
      description: item?.description,
      status: item?.status,
      priority: item?.priority,
      dueDate: item?.dueDate,
      startDate: item?.startDate,
      endDate: item?.endDate,
      url: item?.url,
      assignedToName: item?.assignedTo?.name || null,
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

  const handleInlineUpdate = useCallback((id: string, data: { status?: string; type?: ItemType; startDate?: string | null; endDate?: string | null; assignedToId?: string | null; priority?: number | null }) => {
    const itemSpaceId = resolveItemSpaceId(id);
    const updates = { ...data };

    // Auto-fill dates when status changes
    if (updates.status !== undefined) {
      const item = allItems.find(i => i.id === id);
      const now = new Date().toISOString();

      if ((updates.status === 'done' || updates.status === 'cancelled') && !item?.endDate) {
        updates.endDate = now;
      }
      if (updates.status && updates.status !== 'undefined' && !item?.startDate) {
        if (item?.endDate && new Date(item.endDate) < new Date()) {
          updates.startDate = item.endDate;
        } else if (updates.endDate && new Date(updates.endDate) < new Date()) {
          updates.startDate = updates.endDate;
        } else {
          updates.startDate = now;
        }
      }
    }

    updateItemMutation.mutate({ id, itemSpaceId, data: updates });

    // If status changed on an item with children, propose propagation
    if (data.status !== undefined) {
      const childCount = countDescendants(allItems, id);
      if (childCount > 0) {
        const item = allItems.find(i => i.id === id);
        setPendingStatusPropagation({
          itemId: id,
          itemTitle: item?.title || 'cet élément',
          status: data.status,
          childCount,
          previousStatus: item?.status ?? null,
        });
      }
    }
  }, [resolveItemSpaceId, updateItemMutation, allItems]);

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
        data: { status: pendingStatusPropagation.previousStatus ?? undefined },
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

  const handleOpen = useCallback((id: string) => {
    const itemSpaceId = resolveItemSpaceId(id);
    navigate(`/spaces/${itemSpaceId}/content?item=${id}`);
  }, [resolveItemSpaceId, navigate]);

  const handleOpenInNewTab = useCallback((id: string) => {
    const itemSpaceId = resolveItemSpaceId(id);
    window.open(`/spaces/${itemSpaceId}/content?item=${id}`, '_blank');
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

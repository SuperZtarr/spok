import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';
import type { CreateItemInput, UpdateItemInput, ItemFilterParams } from '@spok/shared';

export function useItems(spaceId: string, params?: ItemFilterParams) {
  return useQuery({
    queryKey: ['items', spaceId, params],
    queryFn: () => itemsApi.list(spaceId, params),
    enabled: !!spaceId,
  });
}

export function useItem(spaceId: string, itemId: string) {
  return useQuery({
    queryKey: ['item', spaceId, itemId],
    queryFn: () => itemsApi.get(spaceId, itemId),
    enabled: !!spaceId && !!itemId,
  });
}

export function useCreateItem(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemInput) => itemsApi.create(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
    },
  });
}

export function useUpdateItem(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemInput }) =>
      itemsApi.update(spaceId, id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, variables.id] });
    },
  });
}

export function useDeleteItem(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => itemsApi.delete(spaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
    },
  });
}

export function useConvertItemToSpace(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { spaceName: string; communityId?: string; parentSpaceId?: string } }) =>
      itemsApi.convertToSpace(spaceId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}

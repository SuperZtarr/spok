import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referentielsApi } from '../lib/api';
import type { SpaceReferentiels } from '@spok/shared';

export function useReferentiels(spaceId: string) {
  return useQuery({
    queryKey: ['referentiels', spaceId],
    queryFn: () => referentielsApi.get(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateReferentiels(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<SpaceReferentiels>) => referentielsApi.update(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiels', spaceId] });
    },
  });
}

export function useResetReferentiels(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => referentielsApi.reset(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiels', spaceId] });
    },
  });
}

export function useCheckStatusUsage(spaceId: string) {
  return useMutation({
    mutationFn: (statusId: string) => referentielsApi.checkStatusUsage(spaceId, statusId),
  });
}

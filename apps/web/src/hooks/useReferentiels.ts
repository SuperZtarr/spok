/*
 * Hooks TanStack Query des référentiels (statuts, labels de types) : lecture par espace (résolus
 * via la communauté côté API) et mutations au niveau communauté.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referentielsApi } from '../lib/api';
import type { SpaceReferentiels } from '@spok/shared';

// Lecture via espace (résout via communauté côté API)
export function useReferentiels(spaceId: string) {
  return useQuery({
    queryKey: ['referentiels', spaceId],
    queryFn: () => referentielsApi.get(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
}

// Lecture via communauté
export function useCommunityReferentiels(communityId: string) {
  return useQuery({
    queryKey: ['community-referentiels', communityId],
    queryFn: () => referentielsApi.getCommunity(communityId),
    enabled: !!communityId,
    staleTime: 5 * 60 * 1000,
  });
}

// Écriture via communauté
export function useUpdateCommunityReferentiels(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<SpaceReferentiels>) => referentielsApi.updateCommunity(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-referentiels', communityId] });
      // Invalider aussi les caches espace qui résolvent via cette communauté
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
    },
  });
}

export function useResetCommunityReferentiels(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => referentielsApi.resetCommunity(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-referentiels', communityId] });
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
    },
  });
}

export function useCheckCommunityStatusUsage(communityId: string) {
  return useMutation({
    mutationFn: (statusId: string) => referentielsApi.checkStatusUsageCommunity(communityId, statusId),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spacesApi } from '../lib/api';
import type { CreateSpaceInput } from '@spok/shared';

export function useSpaces(communityId?: string) {
  return useQuery({
    queryKey: ['spaces', communityId],
    queryFn: () => spacesApi.list(communityId),
  });
}

export function useSpace(spaceId: string) {
  return useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId),
    enabled: !!spaceId,
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSpaceInput) => spacesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });
}

export function useUpdateSpace(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name?: string; communityId?: string | null; parentId?: string | null }) => spacesApi.update(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteChildren = false }: { id: string; deleteChildren?: boolean }) =>
      spacesApi.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });
}

export function useSpaceMembers(spaceId: string) {
  return useQuery({
    queryKey: ['space', spaceId, 'members'],
    queryFn: () => spacesApi.getMembers(spaceId),
    enabled: !!spaceId,
  });
}

export function useInviteMember(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string }) => spacesApi.invite(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId, 'members'] });
    },
  });
}

/*
 * Groupes personnels de communautés (2026-11-27) : lecture (queryKey ['community-groups', userId]) et mutations
 * (créer, renommer, réordonner, supprimer, ranger une communauté). Seul point d'accès à communityGroupsApi.
 * Utilisé par CommunityGroupSelector, CommunityGroupsModal et le menu de la carte de communauté.
 * Visiteur anonyme : liste vide, aucune requête (les groupes sont propres à un compte).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communityGroupsApi, type CommunityGroup } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const EMPTY: CommunityGroup[] = [];

export function useCommunityGroups() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const queryKey = ['community-groups', user?.id];

  const { data: groups = EMPTY, isLoading } = useQuery({
    queryKey,
    queryFn: communityGroupsApi.list,
    enabled: !!user,
    staleTime: Infinity,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['community-groups'] });

  const create = useMutation({ mutationFn: (name: string) => communityGroupsApi.create(name), onSuccess: invalidate });
  const rename = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => communityGroupsApi.rename(id, name), onSuccess: invalidate });
  const reorder = useMutation({ mutationFn: (ids: string[]) => communityGroupsApi.reorder(ids), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => communityGroupsApi.delete(id), onSuccess: invalidate });
  const assign = useMutation({
    mutationFn: ({ communityId, groupId }: { communityId: string; groupId: string | null }) => communityGroupsApi.assign(communityId, groupId),
    onSuccess: invalidate,
  });

  return { groups, isLoading, enabled: !!user, create, rename, reorder, remove, assign };
}

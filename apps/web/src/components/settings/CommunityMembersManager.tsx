import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApi } from '../../lib/api';
import { MembersColumnManager } from './MembersColumnManager';
import type { CommunityRole } from '@spok/shared';

interface CommunityMembersManagerProps {
  communityId: string;
  currentUserRole: string;
  currentUserId: string;
}

export function CommunityMembersManager({
  communityId,
  currentUserRole,
  currentUserId,
}: CommunityMembersManagerProps) {
  const queryClient = useQueryClient();
  const isOwner = currentUserRole === 'OWNER';

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId),
  });

  const { data: availableUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['community-available-users', communityId],
    queryFn: () => communitiesApi.getAvailableUsers(communityId),
    enabled: isOwner,
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      communitiesApi.addMember(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
      queryClient.invalidateQueries({ queryKey: ['community-available-users', communityId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => communitiesApi.removeMember(communityId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
      queryClient.invalidateQueries({ queryKey: ['community-available-users', communityId] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: CommunityRole }) =>
      communitiesApi.updateMemberRole(communityId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
    },
  });

  const memberInfos = (members || []).map(m => ({
    id: m.id,
    userId: m.userId,
    email: m.email,
    name: m.name,
    role: m.role,
  }));

  return (
    <MembersColumnManager
      members={memberInfos}
      availableUsers={availableUsers}
      isLoading={membersLoading || usersLoading}
      isOwner={isOwner}
      currentUserId={currentUserId}
      onAddMember={(userId, role) => addMemberMutation.mutate({ userId, role })}
      onRemoveMember={(memberId) => removeMemberMutation.mutate(memberId)}
      onUpdateRole={(memberId, role) => updateRoleMutation.mutate({ memberId, role: role as CommunityRole })}
      isUpdating={addMemberMutation.isPending || removeMemberMutation.isPending || updateRoleMutation.isPending}
    />
  );
}

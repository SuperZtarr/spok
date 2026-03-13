import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spacesApi } from '../../lib/api';
import { MembersColumnManager } from './MembersColumnManager';

interface SpaceMembersManagerProps {
  spaceId: string;
  currentUserRole: string;
  currentUserId: string;
  spaceType: string;
}

export function SpaceMembersManager({
  spaceId,
  currentUserRole,
  currentUserId,
  spaceType,
}: SpaceMembersManagerProps) {
  const queryClient = useQueryClient();
  const isOwner = currentUserRole === 'OWNER';

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
  });

  const { data: availableUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['space-available-users', spaceId],
    queryFn: () => spacesApi.getAvailableUsers(spaceId),
    enabled: isOwner,
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      spacesApi.addMember(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space-available-users', spaceId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => spacesApi.removeMember(spaceId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space-available-users', spaceId] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      spacesApi.updateMemberRole(spaceId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', spaceId] });
    },
  });

  if (spaceType === 'PERSONAL') {
    return null;
  }

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
      onUpdateRole={(memberId, role) => updateRoleMutation.mutate({ memberId, role })}
      isUpdating={addMemberMutation.isPending || removeMemberMutation.isPending || updateRoleMutation.isPending}
    />
  );
}

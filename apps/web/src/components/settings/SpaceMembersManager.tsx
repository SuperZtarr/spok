/* Gestion des membres d'un espace : rôles, invitations, retrait — page settings espace.
   Actions sur soi (onLeave) : se rétrograder en membre (s'il reste un autre propriétaire) et quitter l'espace
   (confirmation, puis retour à l'accueil). Un changement de son propre rôle rafraîchit l'espace (droits). */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { spacesApi } from '../../lib/api';
import { MembersColumnManager } from './MembersColumnManager';
import { RoleGuard } from '../RoleGuard';

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
      // Son propre rôle a pu changer : droits de la page et sidebar à relire
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const navigate = useNavigate();
  const leaveMutation = useMutation({
    mutationFn: () => spacesApi.leave(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      navigate('/');
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Impossible de quitter l\'espace'),
  });
  const handleLeave = () => {
    if (confirm('Quitter cet espace ? Vous perdrez l\'accès s\'il est privé.')) leaveMutation.mutate();
  };

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
    <RoleGuard role="OWNER">
      <MembersColumnManager
        members={memberInfos}
        availableUsers={availableUsers}
        isLoading={membersLoading || usersLoading}
        isOwner={isOwner}
        currentUserId={currentUserId}
        onAddMember={(userId, role) => addMemberMutation.mutate({ userId, role })}
        onRemoveMember={(memberId) => removeMemberMutation.mutate(memberId)}
        onUpdateRole={(memberId, role) => updateRoleMutation.mutate({ memberId, role })}
        onLeave={handleLeave}
        isUpdating={addMemberMutation.isPending || removeMemberMutation.isPending || updateRoleMutation.isPending || leaveMutation.isPending}
      />
    </RoleGuard>
  );
}

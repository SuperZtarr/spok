import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { communitiesApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmModal } from '../ConfirmModal';
import type { CommunityMember } from '@spok/shared';

interface CommunityMembersManagerProps {
  communityId: string;
  currentUserRole: string;
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
};

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
];

export function CommunityMembersManager({
  communityId,
  currentUserRole,
  currentUserId,
}: CommunityMembersManagerProps) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [removingMember, setRemovingMember] = useState<CommunityMember | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => communitiesApi.invite(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
      setInviteEmail('');
      setInviteRole('MEMBER');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => communitiesApi.removeMember(communityId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
      setRemovingMember(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      communitiesApi.updateMemberRole(communityId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
    },
  });

  const isOwner = currentUserRole === 'OWNER';
  const isAdmin = currentUserRole === 'ADMIN';
  const canInvite = isOwner || isAdmin;
  const canRemove = isOwner || isAdmin;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" />
        Membres de la communauté
      </h2>

      {/* Invite form */}
      {canInvite && (
        <form onSubmit={handleInvite} className="flex gap-2 mb-4">
          <Input
            type="email"
            placeholder="Email du membre à inviter"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1"
          />
          <div className="relative">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-9 px-3 pr-8 text-sm border border-border rounded-md bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <Button
            type="submit"
            disabled={!inviteEmail.trim() || inviteMutation.isPending}
            size="sm"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4 mr-1" />
            )}
            Inviter
          </Button>
        </form>
      )}

      {inviteMutation.isError && (
        <p className="text-sm text-destructive mb-3">
          {(inviteMutation.error as any)?.message || "Erreur lors de l'invitation."}
        </p>
      )}

      {/* Members list */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !members || members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun membre.</p>
      ) : (
        <div className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const memberIsOwner = member.role === 'OWNER';
            const canChangeRole = isOwner && !memberIsOwner && !isSelf;
            const canRemoveMember =
              canRemove && !memberIsOwner && !isSelf &&
              (member.role !== 'ADMIN' || isOwner);

            return (
              <div key={member.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {member.name || member.email}
                    </span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground">(vous)</span>
                    )}
                  </div>
                  {member.name && (
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  )}
                </div>

                {canChangeRole ? (
                  <div className="relative">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          memberId: member.id,
                          role: e.target.value,
                        })
                      }
                      disabled={updateRoleMutation.isPending}
                      className="h-7 px-2 pr-7 text-xs border border-border rounded bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                )}

                {canRemoveMember && (
                  <button
                    onClick={() => setRemovingMember(member)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Retirer ce membre"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={!!removingMember}
        onClose={() => setRemovingMember(null)}
        onConfirm={() => {
          if (removingMember) {
            removeMutation.mutate(removingMember.id);
          }
        }}
        title="Retirer le membre"
        message={`Voulez-vous retirer ${removingMember?.name || removingMember?.email} de cette communauté ?`}
        confirmLabel="Retirer"
        isPending={removeMutation.isPending}
      />
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import type { CommunityRole, Role } from '@spok/shared';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
}

const communityRoleOptions = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
];

const spaceRoleOptions = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
  { value: 'VIEWER', label: 'Lecteur' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const queryClient = useQueryClient();
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedRole, setSelectedRole] = useState<CommunityRole>('MEMBER');

  // Space states
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedSpaceRole, setSelectedSpaceRole] = useState<Role>('MEMBER');

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.users.get(userId),
    enabled: !!userId,
  });

  const { data: communitiesData } = useQuery({
    queryKey: ['admin', 'communities'],
    queryFn: () => adminApi.communities.list({ pageSize: 100 }),
  });

  const { data: spacesData } = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => adminApi.spaces.list({ pageSize: 100 }),
  });

  const addToCommunityMutation = useMutation({
    mutationFn: (data: { communityId: string; role: CommunityRole }) =>
      adminApi.users.addToCommunity(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setShowAddCommunity(false);
      setSelectedCommunityId('');
      setSelectedRole('MEMBER');
    },
  });

  const removeFromCommunityMutation = useMutation({
    mutationFn: (communityId: string) => adminApi.users.removeFromCommunity(userId, communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const addToSpaceMutation = useMutation({
    mutationFn: (data: { spaceId: string; role: Role }) =>
      adminApi.users.addToSpace(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
      setSelectedSpaceRole('MEMBER');
    },
  });

  const removeFromSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => adminApi.users.removeFromSpace(userId, spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
    },
  });

  const handleAddToCommunity = () => {
    if (selectedCommunityId) {
      addToCommunityMutation.mutate({ communityId: selectedCommunityId, role: selectedRole });
    }
  };

  const handleRemoveFromCommunity = (communityId: string, communityName: string) => {
    if (confirm(`Retirer l'utilisateur de la communauté "${communityName}" ?`)) {
      removeFromCommunityMutation.mutate(communityId);
    }
  };

  const handleAddToSpace = () => {
    if (selectedSpaceId) {
      addToSpaceMutation.mutate({ spaceId: selectedSpaceId, role: selectedSpaceRole });
    }
  };

  const handleRemoveFromSpace = (spaceId: string, spaceName: string) => {
    if (confirm(`Retirer l'utilisateur de l'espace "${spaceName}" ?`)) {
      removeFromSpaceMutation.mutate(spaceId);
    }
  };

  // Filter out communities the user is already a member of
  const existingCommunityIds = user?.communityMemberships?.map((m) => m.community.id) || [];
  const availableCommunities = communitiesData?.data.filter((c) => !existingCommunityIds.includes(c.id)) || [];

  const communityOptions = [
    { value: '', label: 'Sélectionner une communauté' },
    ...availableCommunities.map((c) => ({ value: c.id, label: c.name })),
  ];

  // Filter out spaces the user is already a member of, and personal spaces
  const existingSpaceIds = user?.memberships?.map((m) => m.space.id) || [];
  const availableSpaces = spacesData?.data.filter(
    (s) => !existingSpaceIds.includes(s.id) && s.type !== 'PERSONAL'
  ) || [];

  const spaceOptions = [
    { value: '', label: 'Sélectionner un espace' },
    ...availableSpaces.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title="Détails de l'utilisateur" className="max-w-2xl">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : user ? (
        <div className="space-y-6">
          {/* User info */}
          <div className="space-y-4">
            <h3 className="font-medium">Informations</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nom:</span>{' '}
                <span className="font-medium">{user.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>{' '}
                <span className="font-medium">{user.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rôle global:</span>{' '}
                <span className="font-medium">
                  {user.globalRole === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Espaces:</span>{' '}
                <span className="font-medium">{user._count?.memberships || 0}</span>
              </div>
            </div>
          </div>

          {/* Community memberships */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Communautés ({user.communityMemberships?.length || 0})
              </h3>
              {availableCommunities.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCommunity(!showAddCommunity)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              )}
            </div>

            {showAddCommunity && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Select
                    value={selectedCommunityId}
                    onChange={(e) => setSelectedCommunityId(e.target.value)}
                    options={communityOptions}
                    className="flex-1"
                  />
                  <Select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as CommunityRole)}
                    options={communityRoleOptions}
                    className="w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddToCommunity}
                    disabled={!selectedCommunityId || addToCommunityMutation.isPending}
                  >
                    Ajouter à la communauté
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddCommunity(false);
                      setSelectedCommunityId('');
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {user.communityMemberships && user.communityMemberships.length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border">
                {user.communityMemberships.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{membership.community.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {ROLE_LABELS[membership.role] || membership.role}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFromCommunity(membership.community.id, membership.community.name)}
                      disabled={removeFromCommunityMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
                Cet utilisateur n'appartient à aucune communauté
              </p>
            )}
          </div>

          {/* Space memberships */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Espaces ({user.memberships?.filter(m => m.space.type !== 'PERSONAL').length || 0})
              </h3>
              {availableSpaces.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddSpace(!showAddSpace)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              )}
            </div>

            {showAddSpace && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Select
                    value={selectedSpaceId}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    options={spaceOptions}
                    className="flex-1"
                  />
                  <Select
                    value={selectedSpaceRole}
                    onChange={(e) => setSelectedSpaceRole(e.target.value as Role)}
                    options={spaceRoleOptions}
                    className="w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddToSpace}
                    disabled={!selectedSpaceId || addToSpaceMutation.isPending}
                  >
                    Ajouter à l'espace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddSpace(false);
                      setSelectedSpaceId('');
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {user.memberships && user.memberships.filter(m => m.space.type !== 'PERSONAL').length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border">
                {user.memberships
                  .filter(m => m.space.type !== 'PERSONAL')
                  .map((membership) => (
                    <div key={membership.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{membership.space.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {ROLE_LABELS[membership.role] || membership.role}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveFromSpace(membership.space.id, membership.space.name)}
                        disabled={removeFromSpaceMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
                Cet utilisateur n'appartient à aucun espace de groupe
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Utilisateur non trouvé</div>
      )}
    </Modal>
  );
}

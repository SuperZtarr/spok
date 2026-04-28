import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Building2, FolderKanban, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useCtrlS } from '../../hooks/useCtrlS';
import { adminApi } from '../../lib/api';
import { groupSpacesByCommunity } from '../../lib/spaceGrouping';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import type { CommunityRole, Role, GlobalRole } from '@spok/shared';

interface UserDetailModalProps {
  userId: string | null; // null = création
  onClose: () => void;
}

const globalRoleOptions = [
  { value: 'USER', label: 'Utilisateur' },
  { value: 'ADMIN', label: 'Administrateur' },
];

const communityRoleOptions = [
  { value: 'OWNER', label: 'Proprietaire' },
  { value: 'MEMBER', label: 'Membre' },
];

const spaceRoleOptions = [
  { value: 'OWNER', label: 'Proprietaire' },
  { value: 'MEMBER', label: 'Membre' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietaire',
  MEMBER: 'Membre',
};

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const queryClient = useQueryClient();
  const isCreating = !userId;

  // User info
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editGlobalRole, setEditGlobalRole] = useState<GlobalRole>('USER');

  // Community states
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedCommunityRole, setSelectedCommunityRole] = useState<CommunityRole>('MEMBER');

  // Space states
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedSpaceRole, setSelectedSpaceRole] = useState<Role>('MEMBER');

  // Fetch user (only if editing)
  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.users.get(userId!),
    enabled: !!userId,
  });

  // Initialize form when user loads
  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditGlobalRole(user.globalRole);
      setEditPassword('');
    }
  }, [user]);

  const { data: communitiesData } = useQuery({
    queryKey: ['admin', 'communities'],
    queryFn: () => adminApi.communities.list({ pageSize: 100 }),
  });

  const { data: spacesData } = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => adminApi.spaces.list({ pageSize: 100 }),
  });

  // Create user
  const createMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; globalRole: GlobalRole }) =>
      adminApi.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
  });

  // Update user
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; password?: string; globalRole?: GlobalRole }) =>
      adminApi.users.update(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Community mutations
  const addToCommunityMutation = useMutation({
    mutationFn: (data: { communityId: string; role: CommunityRole }) =>
      adminApi.users.addToCommunity(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowAddCommunity(false);
      setSelectedCommunityId('');
    },
  });

  const removeFromCommunityMutation = useMutation({
    mutationFn: (communityId: string) => adminApi.users.removeFromCommunity(userId!, communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Space mutations
  const addToSpaceMutation = useMutation({
    mutationFn: (data: { spaceId: string; role: Role }) =>
      adminApi.users.addToSpace(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
    },
  });

  const removeFromSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => adminApi.users.removeFromSpace(userId!, spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: editName,
      email: editEmail,
      password: editPassword,
      globalRole: editGlobalRole,
    });
  };

  const handleSaveInfo = () => {
    const updates: { name?: string; email?: string; password?: string; globalRole?: GlobalRole } = {};
    if (editName !== user?.name) updates.name = editName;
    if (editEmail !== user?.email) updates.email = editEmail;
    if (editGlobalRole !== user?.globalRole) updates.globalRole = editGlobalRole;
    if (editPassword) updates.password = editPassword;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const hasInfoChanges = user && (
    editName !== user.name ||
    editEmail !== user.email ||
    editGlobalRole !== user.globalRole ||
    editPassword.length > 0
  );

  useCtrlS(!!hasInfoChanges && !updateMutation.isPending, handleSaveInfo);

  const handleAddToCommunity = () => {
    if (selectedCommunityId) {
      addToCommunityMutation.mutate({ communityId: selectedCommunityId, role: selectedCommunityRole });
    }
  };

  const handleRemoveFromCommunity = (communityId: string, _communityName: string) => {
    removeFromCommunityMutation.mutate(communityId);
  };

  const handleAddToSpace = () => {
    if (selectedSpaceId) {
      addToSpaceMutation.mutate({ spaceId: selectedSpaceId, role: selectedSpaceRole });
    }
  };

  const handleRemoveFromSpace = (spaceId: string, _spaceName: string) => {
    removeFromSpaceMutation.mutate(spaceId);
  };

  // Filter available communities and spaces
  const existingCommunityIds = user?.communityMemberships?.map((m) => m.community.id) || [];
  const availableCommunities = communitiesData?.data.filter((c) => !existingCommunityIds.includes(c.id)) || [];

  const existingSpaceIds = user?.memberships?.map((m) => m.space.id) || [];
  const availableSpaces = spacesData?.data.filter(
    (s) => !existingSpaceIds.includes(s.id) && s.type !== 'PERSONAL'
  ) || [];

  const communityOptions = [
    { value: '', label: 'Selectionner une communaute' },
    ...availableCommunities.map((c) => ({ value: c.id, label: c.name })),
  ];

  const spaceBaseOptions = [{ value: '', label: 'Selectionner un espace' }];
  const spaceGroups = useMemo(() => {
    return groupSpacesByCommunity(availableSpaces).map(g => ({
      label: g.label,
      options: g.spaces.map(s => ({ value: s.id, label: s.name })),
    }));
  }, [availableSpaces]);

  // Creation form
  if (isCreating) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Nouvel utilisateur" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {createMutation.error.message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nom complet"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe</label>
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="********"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select
              value={editGlobalRole}
              onChange={(e) => setEditGlobalRole(e.target.value as GlobalRole)}
              options={globalRoleOptions}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="bordered" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  // Detail/edit view
  return (
    <Modal isOpen={true} onClose={onClose} title="Details de l'utilisateur" size="xl">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : user ? (
        <div className="space-y-6">
          {/* User info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <h3 className="font-medium">Informations</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe</label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Laisser vide pour ne pas changer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role global</label>
                  <Select
                    value={editGlobalRole}
                    onChange={(e) => setEditGlobalRole(e.target.value as GlobalRole)}
                    options={globalRoleOptions}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSaveInfo}
                disabled={!hasInfoChanges || updateMutation.isPending}
                className={!hasInfoChanges ? 'opacity-40' : ''}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
              {updateMutation.error && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
            </div>
          </div>

          {/* Community memberships */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Communautes ({user.communityMemberships?.length || 0})
              </h3>
              {availableCommunities.length > 0 && (
                <Button
                  size="sm"
                  variant="bordered"
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
                    value={selectedCommunityRole}
                    onChange={(e) => setSelectedCommunityRole(e.target.value as CommunityRole)}
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
                    Ajouter
                  </Button>
                  <Button
                    size="sm"
                    variant="bordered"
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
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
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
                Aucune communaute
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
                  variant="bordered"
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
                    options={spaceBaseOptions}
                    groups={spaceGroups}
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
                    Ajouter
                  </Button>
                  <Button
                    size="sm"
                    variant="bordered"
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
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
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
                Aucun espace de groupe
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Utilisateur non trouve</div>
      )}
    </Modal>
  );
}

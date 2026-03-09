import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, FolderKanban, Plus, Trash2, Save, UserPlus } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { groupSpacesByCommunity } from '../../lib/spaceGrouping';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import type { CommunityRole } from '@spok/shared';

interface CommunityDetailModalProps {
  communityId: string | null; // null = création
  onClose: () => void;
}

const memberRoleOptions = [
  { value: 'OWNER', label: 'Proprietaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietaire',
  ADMIN: 'Admin',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};

export function CommunityDetailModal({ communityId, onClose }: CommunityDetailModalProps) {
  const queryClient = useQueryClient();
  const isCreating = !communityId;

  // Info editing
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<CommunityRole>('MEMBER');

  // Add space
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');

  // Fetch community details (only if editing)
  const { data: community, isLoading } = useQuery({
    queryKey: ['admin', 'community', communityId],
    queryFn: () => adminApi.communities.get(communityId!),
    enabled: !!communityId,
  });

  // Initialize form when community loads
  useEffect(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description || '');
      setEditIsPublic(community.isPublic);
    }
  }, [community]);

  // Fetch all users for adding members
  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users', { search: memberSearch }],
    queryFn: () => adminApi.users.list({ search: memberSearch, pageSize: 10 }),
    enabled: showAddMember && memberSearch.length > 0,
  });

  // Fetch all spaces for adding to community
  const { data: spacesData } = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => adminApi.spaces.list({ pageSize: 100 }),
  });

  // Create community
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; ownerEmail?: string; isPublic?: boolean }) =>
      adminApi.communities.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      onClose();
    },
  });

  // Update community
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; isPublic?: boolean }) =>
      adminApi.communities.update(communityId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
    },
  });

  // Add member
  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: CommunityRole }) =>
      adminApi.communities.addMember(communityId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      setShowAddMember(false);
      setMemberSearch('');
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => {
      const member = community?.members.find(m => m.id === memberId);
      if (member) {
        return adminApi.users.removeFromCommunity(member.userId, communityId!);
      }
      return Promise.reject(new Error('Member not found'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
    },
  });

  // Add space to community
  const addSpaceMutation = useMutation({
    mutationFn: (spaceId: string) =>
      adminApi.spaces.update(spaceId, { communityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
    },
  });

  // Remove space from community
  const removeSpaceMutation = useMutation({
    mutationFn: (spaceId: string) =>
      adminApi.spaces.update(spaceId, { communityId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: editName,
      description: editDescription || undefined,
      ownerEmail: ownerEmail || undefined,
      isPublic: editIsPublic,
    });
  };

  const handleSaveInfo = () => {
    const updates: { name?: string; description?: string; isPublic?: boolean } = {};
    if (editName !== community?.name) updates.name = editName;
    if (editDescription !== (community?.description || '')) updates.description = editDescription;
    if (editIsPublic !== community?.isPublic) updates.isPublic = editIsPublic;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const hasInfoChanges = community && (
    editName !== community.name ||
    editDescription !== (community.description || '') ||
    editIsPublic !== community.isPublic
  );

  const handleAddMember = (email: string) => {
    addMemberMutation.mutate({ email, role: selectedMemberRole });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (confirm(`Retirer ${memberName} de cette communaute ?`)) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const handleAddSpace = () => {
    if (selectedSpaceId) {
      addSpaceMutation.mutate(selectedSpaceId);
    }
  };

  const handleRemoveSpace = (spaceId: string, spaceName: string) => {
    if (confirm(`Retirer l'espace "${spaceName}" de cette communaute ?`)) {
      removeSpaceMutation.mutate(spaceId);
    }
  };

  // Filter users not already members
  const existingMemberUserIds = community?.members.map(m => m.userId) || [];
  const availableUsers = usersData?.data.filter(u => !existingMemberUserIds.includes(u.id)) || [];

  // Filter spaces not already in this community (and GROUP type only)
  const communitySpaceIds = community?.spaces?.map(s => s.id) || [];
  const availableSpaces = spacesData?.data.filter(
    s => !communitySpaceIds.includes(s.id) && s.type !== 'PERSONAL'
  ) || [];

  const spaceBaseOptions = [{ value: '', label: 'Selectionner un espace...' }];
  const spaceGroups = useMemo(() => {
    return groupSpacesByCommunity(availableSpaces).map(g => ({
      label: g.label,
      options: g.spaces.map(s => ({ value: s.id, label: s.name })),
    }));
  }, [availableSpaces]);

  // Creation form
  if (isCreating) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Nouvelle communaute">
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
              placeholder="Nom de la communaute"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optionnel)"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createIsPublic"
              checked={editIsPublic}
              onChange={(e) => setEditIsPublic(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="createIsPublic" className="text-sm">
              Communauté publique (visible et accessible à tous)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Proprietaire (email)</label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Laisser vide pour vous designer comme proprietaire"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si vide, vous serez le proprietaire de la communaute.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
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
    <Modal isOpen={true} onClose={onClose} title="Details de la communaute">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : community ? (
        <div className="space-y-6">
          {/* Community info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              <h3 className="font-medium">Informations</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optionnel)"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsPublic"
                  checked={editIsPublic}
                  onChange={(e) => setEditIsPublic(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="editIsPublic" className="text-sm">
                  Communauté publique (visible et accessible à tous)
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                Cree le {new Date(community.createdAt).toLocaleDateString('fr-FR')}
              </div>
              {hasInfoChanges && (
                <Button
                  size="sm"
                  onClick={handleSaveInfo}
                  disabled={updateMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Membres ({community.members?.length || 0})
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(!showAddMember)}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {showAddMember && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Rechercher un utilisateur..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={selectedMemberRole}
                    onChange={(e) => setSelectedMemberRole(e.target.value as CommunityRole)}
                    options={memberRoleOptions}
                    className="w-36"
                  />
                </div>
                {availableUsers.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 bg-background rounded hover:bg-accent cursor-pointer"
                        onClick={() => handleAddMember(user.email)}
                      >
                        <div>
                          <div className="text-sm font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <Button size="sm" variant="ghost">
                          Ajouter
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {memberSearch && availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aucun utilisateur trouve
                  </p>
                )}
              </div>
            )}

            {community.members && community.members.length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-auto">
                {community.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="text-sm font-medium">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
                Aucun membre
              </p>
            )}
          </div>

          {/* Spaces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Espaces ({community.spaces?.length || 0})
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
                <Select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  options={spaceBaseOptions}
                  groups={spaceGroups}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddSpace}
                    disabled={!selectedSpaceId || addSpaceMutation.isPending}
                  >
                    Ajouter a la communaute
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

            {community.spaces && community.spaces.length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-auto">
                {community.spaces.map((space) => (
                  <div key={space.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{space.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {space.memberCount} membre(s)
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSpace(space.id, space.name)}
                      disabled={removeSpaceMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
                Aucun espace rattache
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Communaute non trouvee</div>
      )}
    </Modal>
  );
}

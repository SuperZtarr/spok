import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Save, Building2 } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';

interface SpaceDetailModalProps {
  spaceId: string;
  onClose: () => void;
}

const roleOptions = [
  { value: 'OWNER', label: 'Proprietaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
  { value: 'VIEWER', label: 'Lecteur' },
];

const typeOptions = [
  { value: 'PERSONAL', label: 'Personnel' },
  { value: 'GROUP', label: 'Groupe' },
];

export function SpaceDetailModal({ spaceId, onClose }: SpaceDetailModalProps) {
  const queryClient = useQueryClient();
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'PERSONAL' | 'GROUP'>('GROUP');
  const [editCommunityId, setEditCommunityId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberSearch, setNewMemberSearch] = useState('');

  const { data: space, isLoading } = useQuery({
    queryKey: ['admin', 'space', spaceId],
    queryFn: () => adminApi.spaces.get(spaceId),
    enabled: !!spaceId,
  });

  const { data: communitiesData } = useQuery({
    queryKey: ['admin', 'communities'],
    queryFn: () => adminApi.communities.list({ pageSize: 100 }),
  });

  const communityOptions = [
    { value: '', label: 'Aucune communauté' },
    ...(communitiesData?.data.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users', { search: newMemberSearch }],
    queryFn: () => adminApi.users.list({ search: newMemberSearch, pageSize: 10 }),
    enabled: showAddMember && newMemberSearch.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; type?: 'PERSONAL' | 'GROUP'; communityId?: string | null }) =>
      adminApi.spaces.update(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setIsEditing(false);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      adminApi.spaces.addMember(spaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setShowAddMember(false);
      setNewMemberSearch('');
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      adminApi.spaces.updateMember(spaceId, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'space', spaceId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => adminApi.spaces.removeMember(spaceId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  const handleStartEdit = () => {
    if (space) {
      setEditName(space.name);
      setEditType(space.type);
      setEditCommunityId(space.communityId || '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    const data: { name?: string; type?: 'PERSONAL' | 'GROUP'; communityId?: string | null } = {};
    if (editName !== space?.name) data.name = editName;
    if (editType !== space?.type) data.type = editType;
    const newCommunityId = editCommunityId || null;
    if (newCommunityId !== space?.communityId) data.communityId = newCommunityId;
    if (Object.keys(data).length > 0) {
      updateMutation.mutate(data);
    } else {
      setIsEditing(false);
    }
  };

  const handleAddMember = (userId: string) => {
    addMemberMutation.mutate({ userId, role: 'MEMBER' });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (confirm(`Retirer ${memberName} de cet espace ?`)) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const existingMemberIds = space?.members.map((m) => m.userId) || [];
  const availableUsers = usersData?.data.filter((u) => !existingMemberIds.includes(u.id)) || [];

  return (
    <Modal isOpen={true} onClose={onClose} title="Details de l'espace">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : space ? (
        <div className="space-y-6">
          {/* Space info */}
          <div className="space-y-4">
            <h3 className="font-medium">Informations</h3>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <Select
                    value={editType}
                    onChange={(e) => {
                      const newType = e.target.value as 'PERSONAL' | 'GROUP';
                      setEditType(newType);
                      if (newType === 'PERSONAL') setEditCommunityId('');
                    }}
                    options={typeOptions}
                  />
                </div>
                {editType === 'GROUP' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Communauté</label>
                    <Select
                      value={editCommunityId}
                      onChange={(e) => setEditCommunityId(e.target.value)}
                      options={communityOptions}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nom:</span>{' '}
                  <span className="font-medium">{space.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">
                    {space.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
                  </span>
                </div>
                {space.type === 'GROUP' && (
                  <div>
                    <span className="text-muted-foreground">Communauté:</span>{' '}
                    <span className="font-medium">
                      {space.community ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {space.community.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">Aucune</span>
                      )}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Elements:</span>{' '}
                  <span className="font-medium">{space.itemCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cree le:</span>{' '}
                  <span className="font-medium">
                    {new Date(space.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="col-span-2">
                  <Button size="sm" variant="outline" onClick={handleStartEdit}>
                    Modifier
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Membres ({space.members.length})</h3>
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
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={newMemberSearch}
                  onChange={(e) => setNewMemberSearch(e.target.value)}
                />
                {availableUsers.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 bg-background rounded hover:bg-accent cursor-pointer"
                        onClick={() => handleAddMember(user.id)}
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
                {newMemberSearch && availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aucun utilisateur trouve
                  </p>
                )}
              </div>
            )}

            <div className="border border-border rounded-lg divide-y divide-border">
              {space.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onChange={(e) =>
                        updateMemberMutation.mutate({
                          memberId: member.id,
                          role: e.target.value,
                        })
                      }
                      options={roleOptions}
                      className="w-36 text-sm"
                    />
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
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Espace non trouve</div>
      )}
    </Modal>
  );
}

import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, FolderKanban, Plus, Trash2, Loader2, Save, Camera, ImageIcon } from 'lucide-react';
import { ImageUploadZone } from '../components/ui/ImageUploadZone';
import { communitiesApi, spacesApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export function CommunitySettingsPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');

  // Fetch community details
  const { data: community, isLoading: communityLoading } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  // Fetch community members
  const { data: members } = useQuery({
    queryKey: ['community', communityId, 'members'],
    queryFn: () => communitiesApi.getMembers(communityId!),
    enabled: !!communityId,
  });

  // Fetch all user's spaces to find those in this community
  const { data: allSpaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  // Spaces in this community
  const communitySpaces = allSpaces?.filter(s => s.communityId === communityId) || [];

  // Spaces that can be added (GROUP spaces not in any community, owned/admin by user)
  const availableSpaces = allSpaces?.filter(
    s => s.type === 'GROUP' &&
         !s.communityId &&
         ['OWNER', 'ADMIN'].includes(s.role)
  ) || [];

  // Check permissions
  const canEdit = community?.role === 'OWNER' || community?.role === 'ADMIN';

  // Update community mutation
  const updateCommunityMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; isPublic?: boolean }) =>
      communitiesApi.update(communityId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setIsEditingInfo(false);
    },
  });

  // Add space to community
  const addSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesApi.update(spaceId, { communityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
    },
  });

  // Remove space from community
  const removeSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesApi.update(spaceId, { communityId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
    },
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Image mutations
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => communitiesApi.uploadAvatar(communityId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => communitiesApi.deleteAvatar(communityId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => communitiesApi.uploadCover(communityId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const deleteCoverMutation = useMutation({
    mutationFn: () => communitiesApi.deleteCover(communityId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const handleStartEdit = () => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description || '');
      setEditIsPublic(community.isPublic);
      setIsEditingInfo(true);
    }
  };

  const handleSaveInfo = () => {
    const updates: { name?: string; description?: string; isPublic?: boolean } = {};
    if (editName !== community?.name) updates.name = editName;
    if (editDescription !== (community?.description || '')) updates.description = editDescription;
    if (editIsPublic !== community?.isPublic && community?.role === 'OWNER') updates.isPublic = editIsPublic;
    if (Object.keys(updates).length > 0) {
      updateCommunityMutation.mutate(updates);
    } else {
      setIsEditingInfo(false);
    }
  };

  const handleAddSpace = () => {
    if (selectedSpaceId) {
      addSpaceMutation.mutate(selectedSpaceId);
    }
  };

  const handleRemoveSpace = (spaceId: string, spaceName: string) => {
    if (confirm(`Retirer l'espace "${spaceName}" de cette communauté ?`)) {
      removeSpaceMutation.mutate(spaceId);
    }
  };

  if (communityLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Communauté non trouvée ou accès refusé.</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto overflow-auto flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} title="Retour au tableau de bord">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            {community.name}
          </h1>
          <p className="text-muted-foreground">Paramètres de la communauté</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Community info */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Informations</h2>

          {isEditingInfo ? (
            <div className="space-y-4">
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
                  placeholder="Description de la communauté"
                />
              </div>
              {community?.role === 'OWNER' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="isPublic" className="text-sm">
                    Communauté publique (visible et accessible à tous les utilisateurs)
                  </label>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveInfo}
                  disabled={updateCommunityMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Enregistrer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingInfo(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nom:</span>{' '}
                  <span className="font-medium">{community.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rôle:</span>{' '}
                  <span className="font-medium">
                    {community.role === 'OWNER' ? 'Propriétaire' : community.role === 'ADMIN' ? 'Administrateur' : 'Membre'}
                  </span>
                </div>
                {community.description && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Description:</span>{' '}
                    <span>{community.description}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Membres:</span>{' '}
                  <span className="font-medium">{members?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Espaces:</span>{' '}
                  <span className="font-medium">{communitySpaces.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Visibilité:</span>{' '}
                  <span className={`font-medium ${community.isPublic ? 'text-green-600' : ''}`}>
                    {community.isPublic ? 'Publique' : 'Privée'}
                  </span>
                </div>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={handleStartEdit} title="Modifier les informations de la communauté">
                  Modifier
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Images */}
        {canEdit && (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Images
            </h2>
            <div className="space-y-6">
              {/* Avatar */}
              <div>
                <label className="block text-sm font-medium mb-2">Avatar</label>
                <div className="flex items-center gap-4">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {community.avatarUrl ? (
                      <img
                        src={community.avatarUrl}
                        alt="Avatar de la communauté"
                        className="w-16 h-16 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploadAvatarMutation.isPending ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      256 × 256 px, rond. Cliquez pour modifier.
                    </p>
                    {community.avatarUrl && (
                      <button
                        onClick={() => deleteAvatarMutation.mutate()}
                        disabled={deleteAvatarMutation.isPending}
                        className="text-xs text-destructive hover:underline self-start"
                      >
                        Supprimer l'avatar
                      </button>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAvatarMutation.mutate(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Cover */}
              <div>
                <label className="block text-sm font-medium mb-2">Image de couverture</label>
                <p className="text-xs text-muted-foreground mb-2">
                  1200 × 400 px recommandé. Affichée en bandeau sur les cartes du Dashboard.
                </p>
                <ImageUploadZone
                  currentUrl={community.coverUrl}
                  onUpload={(file) => uploadCoverMutation.mutate(file)}
                  onRemove={() => deleteCoverMutation.mutate()}
                  isUploading={uploadCoverMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}

        {/* Spaces section */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderKanban className="w-5 h-5" />
              Espaces ({communitySpaces.length})
            </h2>
            {canEdit && availableSpaces.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddSpace(!showAddSpace)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Ajouter un espace
              </Button>
            )}
          </div>

          {/* Add space form */}
          {showAddSpace && (
            <div className="p-4 bg-muted rounded-lg mb-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sélectionnez un espace de groupe à rattacher à cette communauté :
              </p>
              <Select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                options={[
                  { value: '', label: 'Choisir un espace...' },
                  ...availableSpaces.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddSpace}
                  disabled={!selectedSpaceId || addSpaceMutation.isPending}
                >
                  {addSpaceMutation.isPending ? 'Ajout...' : 'Ajouter'}
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

          {/* Spaces list */}
          {communitySpaces.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun espace rattaché à cette communauté.
            </p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {communitySpaces.map((space) => (
                <div key={space.id} className="flex items-center justify-between p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:text-primary"
                    onClick={() => navigate(`/spaces/${space.id}`)}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <div>
                      <div className="font-medium">{space.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {space.memberCount} membre{(space.memberCount || 0) > 1 ? 's' : ''} · {space.itemCount || 0} élément{(space.itemCount || 0) > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {canEdit && ['OWNER', 'ADMIN'].includes(space.role) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSpace(space.id, space.name)}
                      disabled={removeSpaceMutation.isPending}
                      title="Retirer l'espace de la communauté"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && availableSpaces.length === 0 && communitySpaces.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Tous vos espaces de groupe sont déjà rattachés à une communauté.
            </p>
          )}
        </div>

        {/* Members section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" />
            Membres ({members?.length || 0})
          </h2>

          {members && members.length > 0 ? (
            <div className="border border-border rounded-lg divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {member.role === 'OWNER' ? 'Propriétaire' : member.role === 'ADMIN' ? 'Admin' : 'Membre'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun membre.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

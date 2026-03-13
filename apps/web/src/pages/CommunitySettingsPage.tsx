import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, FolderKanban, FolderOpen, Plus, Trash2, Loader2, Save, Camera, ImageIcon, Tag as TagIcon, Pencil, X, GripVertical, ChevronRight } from 'lucide-react';
import { ImageUploadZone } from '../components/ui/ImageUploadZone';
import { communitiesApi, spacesApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ConfirmModal } from '../components/ConfirmModal';
import { CommunityMembersManager } from '../components/settings/CommunityMembersManager';
import { useAuthStore } from '../stores/auth';

function RootDropZone({ onMove }: { onMove: (spaceId: string, newParentId: string | null) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/spok-space-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const draggedId = e.dataTransfer.getData('application/spok-space-id');
        if (draggedId) onMove(draggedId, null);
      }}
      className={`flex items-center justify-center p-2 rounded-lg border border-dashed transition-colors text-xs text-muted-foreground ${
        isDragOver ? 'border-primary bg-primary/5 text-primary' : 'border-transparent'
      }`}
    >
      {isDragOver ? 'Déposer ici pour mettre à la racine' : ''}
    </div>
  );
}

function SpaceTreeNode({ node, level, onMove }: { node: any; level: number; onMove: (spaceId: string, newParentId: string | null) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <>
      <Link
        to={`/spaces/${node.id}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/spok-space-id', node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/spok-space-id')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const draggedId = e.dataTransfer.getData('application/spok-space-id');
          if (draggedId && draggedId !== node.id) onMove(draggedId, node.id);
        }}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border hover:bg-accent/50'}`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
        {level > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <p className="text-xs text-muted-foreground">{node.itemCount || 0} élément{(node.itemCount || 0) > 1 ? 's' : ''}</p>
        </div>
      </Link>
      {node.children?.map((child: any) => (
        <SpaceTreeNode key={child.id} node={child} level={level + 1} onMove={onMove} />
      ))}
    </>
  );
}

export function CommunitySettingsPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'images' | 'spaces' | 'members'>('general');

  // Fetch community details
  const { data: community, isLoading: communityLoading } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  // Fetch all user's spaces to find those in this community
  const { data: allSpaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  useEffect(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description || '');
      setEditIsPublic(community.isPublic);
    }
  }, [community]);

  // Spaces in this community
  const communitySpaces = allSpaces?.filter(s => s.communityId === communityId) || [];

  // Build space tree
  const spaceTree = useMemo(() => {
    type SpaceNode = (typeof communitySpaces)[number] & { children: SpaceNode[] };
    const map = new Map<string, SpaceNode>();
    const roots: SpaceNode[] = [];
    communitySpaces.forEach(s => map.set(s.id, { ...s, children: [] }));
    communitySpaces.forEach(s => {
      if (s.parentId && map.has(s.parentId)) {
        map.get(s.parentId)!.children.push(map.get(s.id)!);
      } else {
        roots.push(map.get(s.id)!);
      }
    });
    return roots;
  }, [communitySpaces]);

  const moveSpaceMutation = useMutation({
    mutationFn: ({ spaceId, parentId }: { spaceId: string; parentId: string | null }) =>
      spacesApi.update(spaceId, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const handleMoveSpace = (spaceId: string, newParentId: string | null) => {
    moveSpaceMutation.mutate({ spaceId, parentId: newParentId });
  };

  // Spaces that can be added (GROUP spaces not in any community, owned/admin by user)
  const availableSpaces = allSpaces?.filter(
    s => s.type === 'GROUP' &&
         !s.communityId &&
         s.role === 'OWNER'
  ) || [];

  // Check permissions
  const canEdit = community?.role === 'OWNER';

  // Update community mutation
  const updateCommunityMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; isPublic?: boolean }) =>
      communitiesApi.update(communityId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  // Add space to community
  const addSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesApi.update(spaceId, { communityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
    },
  });


  // Create new space in this community
  const createSpaceMutation = useMutation({
    mutationFn: (name: string) => spacesApi.create({ name, type: 'GROUP', communityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      setShowCreateSpace(false);
      setNewSpaceName('');
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

  const handleSaveInfo = () => {
    const updates: { name?: string; description?: string; isPublic?: boolean } = {};
    if (editName !== community?.name) updates.name = editName;
    if (editDescription !== (community?.description || '')) updates.description = editDescription;
    if (editIsPublic !== community?.isPublic && community?.role === 'OWNER') updates.isPublic = editIsPublic;
    if (Object.keys(updates).length > 0) {
      updateCommunityMutation.mutate(updates);
    }
  };

  const handleAddSpace = () => {
    if (selectedSpaceId) {
      addSpaceMutation.mutate(selectedSpaceId);
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
      <div className="p-6">
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
    <div className="p-6 overflow-auto flex-1 min-h-0">
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

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          {([
            { id: 'general', label: 'Général' },
            ...(canEdit ? [{ id: 'images' as const, label: 'Images' }] : []),
            { id: 'spaces', label: `Espaces (${communitySpaces.length})` },
            { id: 'members', label: `Membres (${community.memberCount || 0})` },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* === GENERAL TAB === */}
        {activeTab === 'general' && (
          <>
            {/* Community info */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Informations</h2>

              {canEdit ? (
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
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>Rôle : <span className="font-medium text-foreground">
                      {community.role === 'OWNER' ? 'Propriétaire' : 'Membre'}
                    </span></div>
                    <div>Membres : <span className="font-medium text-foreground">{community.memberCount || 0}</span></div>
                    <div>Espaces : <span className="font-medium text-foreground">{communitySpaces.length}</span></div>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      onClick={handleSaveInfo}
                      disabled={updateCommunityMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Nom:</span> <span className="font-medium">{community.name}</span></div>
                  <div><span className="text-muted-foreground">Rôle:</span> <span className="font-medium">
                    {community.role === 'OWNER' ? 'Propriétaire' : 'Membre'}
                  </span></div>
                  {community.description && (
                    <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span>{community.description}</span></div>
                  )}
                  <div><span className="text-muted-foreground">Membres:</span> <span className="font-medium">{community.memberCount || 0}</span></div>
                  <div><span className="text-muted-foreground">Espaces:</span> <span className="font-medium">{communitySpaces.length}</span></div>
                  <div><span className="text-muted-foreground">Visibilité:</span> <span className={`font-medium ${community.isPublic ? 'text-green-600' : ''}`}>
                    {community.isPublic ? 'Publique' : 'Privée'}
                  </span></div>
                </div>
              )}
            </div>

            {/* Community Tags */}
            {community.role === 'OWNER' && (
              <CommunityTagsSection communityId={communityId!} />
            )}
          </>
        )}

        {/* === IMAGES TAB === */}
        {activeTab === 'images' && canEdit && (
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

        {/* === SPACES TAB === */}
        {activeTab === 'spaces' && (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FolderKanban className="w-5 h-5" />
                Espaces ({communitySpaces.length})
              </h2>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { setShowCreateSpace(!showCreateSpace); setShowAddSpace(false); }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Créer un espace
                  </Button>
                  {availableSpaces.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowAddSpace(!showAddSpace); setShowCreateSpace(false); }}
                    >
                      Rattacher un espace existant
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Create space form */}
            {showCreateSpace && (
              <div className="p-4 bg-muted rounded-lg mb-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Créer un nouvel espace dans cette communauté :
                </p>
                <Input
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Nom de l'espace"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSpaceName.trim()) {
                      createSpaceMutation.mutate(newSpaceName.trim());
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => createSpaceMutation.mutate(newSpaceName.trim())}
                    disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                  >
                    {createSpaceMutation.isPending ? 'Création...' : 'Créer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowCreateSpace(false); setNewSpaceName(''); }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

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

            {/* Space tree */}
            {spaceTree.length > 0 ? (
              <div className="space-y-1">
                {canEdit && <RootDropZone onMove={handleMoveSpace} />}
                {spaceTree.map(node => (
                  <SpaceTreeNode key={node.id} node={node} level={0} onMove={handleMoveSpace} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun espace rattaché à cette communauté.
              </p>
            )}

            {canEdit && availableSpaces.length === 0 && communitySpaces.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Tous vos espaces de groupe sont déjà rattachés à une communauté.
              </p>
            )}
          </div>
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && user && (
          <div className="bg-card border rounded-lg p-6">
            <CommunityMembersManager
              communityId={communityId!}
              currentUserRole={community.role || 'MEMBER'}
              currentUserId={user.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityTagsSection({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deletingTag, setDeletingTag] = useState<{ id: string; name: string } | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ['community-tags', communityId],
    queryFn: () => communitiesApi.getTags(communityId),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) => communitiesApi.createTag(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-tags', communityId] });
      setNewTagName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: { name?: string; color?: string | null } }) =>
      communitiesApi.updateTag(communityId, tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-tags', communityId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => communitiesApi.deleteTag(communityId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-tags', communityId] });
    },
  });

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TagIcon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Tags communautaires</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Ces tags sont disponibles dans tous les espaces de la communauté.
      </p>

      {/* Existing tags */}
      <div className="space-y-2 mb-4">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            {editingId === tag.id ? (
              <>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateMutation.mutate({ tagId: tag.id, data: { name: editName, color: editColor } });
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 px-2 py-0.5 text-sm border border-border rounded bg-background"
                  autoFocus
                />
                <button
                  onClick={() => updateMutation.mutate({ tagId: tag.id, data: { name: editName, color: editColor } })}
                  className="p-1 text-primary hover:bg-accent rounded"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-accent rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {tag.color && (
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                )}
                <span className="flex-1 text-sm">{tag.name}</span>
                <span className="text-xs text-muted-foreground">{tag.itemCount} items</span>
                <button
                  onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color || '#6366f1'); }}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingTag({ id: tag.id, name: tag.name })}
                  className="p-1 text-muted-foreground hover:text-destructive hover:bg-accent rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Aucun tag communautaire</p>
        )}
      </div>

      {/* Create new tag */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTagName.trim()) createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
          }}
          placeholder="Nouveau tag..."
          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
        <Button
          size="sm"
          onClick={() => { if (newTagName.trim()) createMutation.mutate({ name: newTagName.trim(), color: newTagColor }); }}
          disabled={!newTagName.trim() || createMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      <ConfirmModal
        isOpen={!!deletingTag}
        onClose={() => setDeletingTag(null)}
        onConfirm={() => {
          if (deletingTag) deleteMutation.mutate(deletingTag.id);
          setDeletingTag(null);
        }}
        title="Supprimer ce tag ?"
        message={`Supprimer le tag « ${deletingTag?.name} » ?`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}

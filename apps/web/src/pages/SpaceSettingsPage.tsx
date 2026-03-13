import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Save, Loader2, Building2, Trash2, AlertTriangle, Camera, ImageIcon, Mail } from 'lucide-react';
import { SpaceDeleteConfirmModal } from '../components/SpaceDeleteConfirmModal';
import { ImageUploadZone } from '../components/ui/ImageUploadZone';
import { useReferentiels, useUpdateReferentiels, useResetReferentiels, useCheckStatusUsage } from '../hooks/useReferentiels';
import { useSpace, useUpdateSpace, useDeleteSpace } from '../hooks/useSpaces';
import { communitiesApi, spacesApi } from '../lib/api';
import { groupSpacesByCommunity } from '../lib/spaceGrouping';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusManager } from '../components/settings/StatusManager';
import { TypeLabelsManager } from '../components/settings/TypeLabelsManager';
import { SpaceMembersManager } from '../components/settings/SpaceMembersManager';
import { OrgChartView } from '../components/views/OrgChartView';
import { SendEmailModal } from '../components/SendEmailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import type { StatusConfig, TypeLabelConfig, Role } from '@spok/shared';

export function SpaceSettingsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId!);
  const { data: referentielsData, isLoading: referentielsLoading } = useReferentiels(spaceId!);
  const updateMutation = useUpdateReferentiels(spaceId!);
  const resetMutation = useResetReferentiels(spaceId!);
  const checkUsageMutation = useCheckStatusUsage(spaceId!);
  const updateSpaceMutation = useUpdateSpace(spaceId!);
  const deleteSpaceMutation = useDeleteSpace();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'images' | 'referentiels' | 'members' | 'danger'>('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { data: spaceMembers } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId!),
    enabled: !!spaceId && space?.type === 'GROUP',
  });

  // Image mutations
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => spacesApi.uploadAvatar(spaceId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => spacesApi.deleteAvatar(spaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => spacesApi.uploadCover(spaceId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const deleteCoverMutation = useMutation({
    mutationFn: () => spacesApi.deleteCover(spaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  // Fetch communities user belongs to
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  // Fetch all spaces for parent selector
  const { data: allSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  const [localStatuses, setLocalStatuses] = useState<StatusConfig[] | null>(null);
  const [localTypeLabels, setLocalTypeLabels] = useState<Record<string, TypeLabelConfig> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Space info state
  const [editName, setEditName] = useState('');
  const [editCommunityId, setEditCommunityId] = useState<string>('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [editDefaultRole, setEditDefaultRole] = useState<string>('');

  // Initialize local state when data loads
  useEffect(() => {
    if (referentielsData && localStatuses === null) {
      setLocalStatuses(referentielsData.referentiels.statuses);
      setLocalTypeLabels(referentielsData.referentiels.typeLabels);
    }
  }, [referentielsData, localStatuses]);

  // Initialize space info state
  useEffect(() => {
    if (space && !editName) {
      setEditName(space.name);
      setEditCommunityId(space.communityId || '');
      setEditParentId(space.parentId || '');
      setEditDefaultRole(space.defaultRole || '');
    }
  }, [space, editName]);

  const handleStatusesChange = (statuses: StatusConfig[]) => {
    setLocalStatuses(statuses);
    setHasChanges(true);
  };

  const handleTypeLabelsChange = (typeLabels: Record<string, TypeLabelConfig>) => {
    setLocalTypeLabels(typeLabels);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localStatuses || !localTypeLabels) return;

    await updateMutation.mutateAsync({
      statuses: localStatuses,
      typeLabels: localTypeLabels,
    });
    setHasChanges(false);
  };

  const handleReset = async () => {
    const result = await resetMutation.mutateAsync();
    setLocalStatuses(result.referentiels.statuses);
    setLocalTypeLabels(result.referentiels.typeLabels);
    setHasChanges(false);
    setShowResetConfirm(false);
  };

  const handleCheckUsage = async (statusId: string) => {
    const result = await checkUsageMutation.mutateAsync(statusId);
    return result;
  };

  const handleSaveSpaceInfo = async () => {
    if (!space) return;

    const updates: { name?: string; communityId?: string | null; parentId?: string | null; defaultRole?: Role | null } = {};
    if (editName !== space.name) updates.name = editName;
    const newCommunityId = editCommunityId || null;
    if (newCommunityId !== space.communityId) updates.communityId = newCommunityId;
    const newParentId = editParentId || null;
    if (newParentId !== (space.parentId || null)) updates.parentId = newParentId;
    const newDefaultRole = (editDefaultRole || null) as Role | null;
    if (newDefaultRole !== (space.defaultRole || null)) updates.defaultRole = newDefaultRole;

    if (Object.keys(updates).length > 0) {
      await updateSpaceMutation.mutateAsync(updates);
    }
  };

  const hasSpaceInfoChanges = space && (
    editName !== space.name ||
    (editCommunityId || null) !== space.communityId ||
    (editParentId || null) !== (space.parentId || null) ||
    (editDefaultRole || null) !== (space.defaultRole || null)
  );

  const communityOptions = [
    { value: '', label: 'Aucune communauté' },
    ...(communities?.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  // Build parent space options grouped by community, excluding self and descendants
  const { parentSpaceBaseOptions, parentSpaceGroups } = useMemo(() => {
    if (!allSpaces || !spaceId) return { parentSpaceBaseOptions: [{ value: '', label: 'Aucun (espace racine)' }], parentSpaceGroups: [] };

    // Collect all descendant IDs to exclude
    const excludeIds = new Set<string>([spaceId]);
    const findDescendants = (parentId: string) => {
      for (const s of allSpaces) {
        if (s.parentId === parentId && !excludeIds.has(s.id)) {
          excludeIds.add(s.id);
          findDescendants(s.id);
        }
      }
    };
    findDescendants(spaceId);

    const eligible = allSpaces.filter(s => s.type === 'GROUP' && !excludeIds.has(s.id));
    const groups = groupSpacesByCommunity(eligible).map(g => ({
      label: g.label,
      options: g.spaces.map(s => ({ value: s.id, label: s.name })),
    }));

    return {
      parentSpaceBaseOptions: [{ value: '', label: 'Aucun (espace racine)' }],
      parentSpaceGroups: groups,
    };
  }, [allSpaces, spaceId]);

  // Check permissions
  const canEdit = space?.role === 'OWNER';

  // Check delete permission: space OWNER or community OWNER
  const communityRole = communities?.find(c => c.id === space?.communityId)?.role;
  const canDelete = space?.role === 'OWNER' || communityRole === 'OWNER';

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteSpace = async (deleteChildren: boolean) => {
    if (!space) return;
    await deleteSpaceMutation.mutateAsync({ id: space.id, deleteChildren });
    navigate('/');
  };

  if (spaceLoading || referentielsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Vous n'avez pas les permissions pour modifier les paramètres de cet espace.
          </p>
          <Link
            to={`/spaces/${spaceId}/content`}
            className="text-yellow-700 underline hover:text-yellow-900 mt-2 inline-block"
          >
            Retour à l'espace
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    ...(space?.type === 'GROUP' ? [{ id: 'general' as const, label: 'Général' }] : []),
    { id: 'images' as const, label: 'Images' },
    { id: 'referentiels' as const, label: 'Référentiels' },
    ...(space?.type === 'GROUP' ? [{ id: 'members' as const, label: `Membres (${spaceMembers?.length || 0})` }] : []),
    ...(canDelete ? [{ id: 'danger' as const, label: 'Danger' }] : []),
  ];

  return (
    <div className="p-6 overflow-auto flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/spaces/${spaceId}/content`)}
          title="Retour à l'espace"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            {space?.name}
          </h1>
          <p className="text-muted-foreground">Paramètres de l'espace</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
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
        {activeTab === 'general' && space?.type === 'GROUP' && (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informations générales
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom de l'espace</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nom de l'espace"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Communauté</label>
                <Select
                  value={editCommunityId}
                  onChange={(e) => setEditCommunityId(e.target.value)}
                  options={communityOptions}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rattacher cet espace à une communauté dont vous êtes membre
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Espace parent</label>
                <Select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  options={parentSpaceBaseOptions}
                  groups={parentSpaceGroups}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Imbriquer cet espace sous un autre espace de groupe
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rôle par défaut des nouveaux membres</label>
                <Select
                  value={editDefaultRole}
                  onChange={(e) => setEditDefaultRole(e.target.value)}
                  options={[
                    { value: '', label: 'Pas d\'accès automatique' },
                    { value: 'MEMBER', label: 'Membre' },
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quand un utilisateur rejoint la communauté, il sera automatiquement ajouté à cet espace avec ce rôle
                </p>
              </div>
              {hasSpaceInfoChanges && (
                <Button
                  onClick={handleSaveSpaceInfo}
                  disabled={updateSpaceMutation.isPending}
                  size="sm"
                >
                  {updateSpaceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer les modifications
                </Button>
              )}
            </div>
          </div>
        )}

        {/* === IMAGES TAB === */}
        {activeTab === 'images' && (
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
                    {space?.avatarUrl ? (
                      <img
                        src={space.avatarUrl}
                        alt="Avatar de l'espace"
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
                    {space?.avatarUrl && (
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
                  1200 × 400 px recommandé. Affichée en bandeau sur la carte du Dashboard.
                </p>
                <ImageUploadZone
                  currentUrl={space?.coverUrl}
                  onUpload={(file) => uploadCoverMutation.mutate(file)}
                  onRemove={() => deleteCoverMutation.mutate()}
                  isUploading={uploadCoverMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}

        {/* === REFERENTIELS TAB === */}
        {activeTab === 'referentiels' && (
          <>
            {/* Info banner */}
            {referentielsData?.isDefault && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  Cet espace utilise actuellement les paramètres par défaut.
                  Les modifications seront sauvegardées spécifiquement pour cet espace.
                </p>
              </div>
            )}

            {/* Unsaved changes warning */}
            {hasChanges && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  Vous avez des modifications non enregistrées.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                disabled={resetMutation.isPending}
                title="Rétablir les paramètres par défaut"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>

            {/* Statuses */}
            <div className="bg-card border rounded-lg p-6">
              {localStatuses && (
                <StatusManager
                  statuses={localStatuses}
                  onChange={handleStatusesChange}
                  onCheckUsage={handleCheckUsage}
                />
              )}
            </div>

            {/* Type Labels */}
            <div className="bg-card border rounded-lg p-6">
              {localTypeLabels && (
                <TypeLabelsManager
                  typeLabels={localTypeLabels}
                  onChange={handleTypeLabelsChange}
                />
              )}
            </div>
          </>
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && space?.type === 'GROUP' && user && (
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div />
              {space.role === 'OWNER' && spaceMembers && spaceMembers.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
                  <Mail className="w-4 h-4 mr-1.5" />Envoyer un email
                </Button>
              )}
            </div>
            <SpaceMembersManager
              spaceId={spaceId!}
              currentUserRole={space.role || 'MEMBER'}
              currentUserId={user.id}
              spaceType={space.type}
            />
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Organigramme</h3>
              <div className="h-[400px] border rounded-lg overflow-hidden">
                <OrgChartView spaceId={spaceId!} spaceName={space.name} />
              </div>
            </div>
          </div>
        )}

        {/* === DANGER TAB === */}
        {activeTab === 'danger' && canDelete && (
          <div className="border border-destructive/30 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Zone de danger
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              La suppression d'un espace est irréversible. Tous les éléments, relations et contributions seront définitivement perdus.
            </p>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleteSpaceMutation.isPending}
            >
              {deleteSpaceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer cet espace
            </Button>
          </div>
        )}

        {canDelete && space && (
          <SpaceDeleteConfirmModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={(deleteChildren) => {
              setShowDeleteModal(false);
              handleDeleteSpace(deleteChildren);
            }}
            spaceId={space.id}
            spaceName={space.name}
            isPending={deleteSpaceMutation.isPending}
          />
        )}
      </div>

      {/* Email modal */}
      {space && spaceMembers && (
        <SendEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          members={spaceMembers.map(m => ({ userId: m.userId, name: m.name, email: m.email }))}
          target={{ type: 'space', id: space.id, name: space.name }}
        />
      )}

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title="Réinitialiser les paramètres ?"
        message="Tous les statuts et libellés de types seront rétablis aux valeurs par défaut."
        confirmLabel="Réinitialiser"
        isPending={resetMutation.isPending}
      />
    </div>
  );
}

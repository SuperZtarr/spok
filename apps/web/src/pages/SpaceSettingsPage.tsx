/* Paramètres d'espace (/spaces/:id/settings) : infos, visibilité, membres, vue par défaut — OWNER.
   Vue par défaut non réglée (defaultView null) : affichée « Liste », ce que SpacePage ouvre réellement.
   Mode admin = mêmes droits que le OWNER (canEdit) : SpaceMembersManager reçoit alors 'OWNER'.
   Visibilité : 4 choix, dont « Héritée — X » (envoyé null ; X = inheritedVisibility renvoyé par GET /spaces/:id).
   Quitter : membre direct sans droits de gestion → bouton sur l'écran « pas les permissions » ; propriétaire →
   onglet Membres (se rétrograder puis quitter, s'il reste un autre propriétaire).
   Suppression : erreur API affichée sous le bouton (jamais de mutateAsync sans catch → rejet non géré Sentry).
   Après suppression → espace parent, sinon page de la communauté, sinon accueil ; après départ → page de la
   communauté, sinon accueil (le parent peut être inaccessible). Ne jamais renvoyer à '/' un espace de
   communauté : la barre latérale quitterait le mode communauté (bug corrigé le 2026-10-16). */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Building2, Trash2, AlertTriangle, Camera, ImageIcon, ArrowRightLeft } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { PAGE_HELP } from '../help/pageHelp';
import { FieldHelp } from '../help/FieldHelp';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { SpaceDeleteConfirmModal } from '../components/SpaceDeleteConfirmModal';
import { ImageUploadZone } from '../components/ui/ImageUploadZone';
import { CoverPositionEditor } from '../components/ui/CoverPositionEditor';
import { usePasteUpload } from '../hooks/usePasteUpload';
import { useCtrlS } from '../hooks/useCtrlS';
import { useSpace, useUpdateSpace, useDeleteSpace } from '../hooks/useSpaces';
import { communitiesApi, spacesApi } from '../lib/api';
import { groupSpacesByCommunity } from '../lib/spaceGrouping';
import { useAuthStore } from '../stores/auth';
import { useAdminMode } from '../components/DevDbStatus';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SpaceMembersManager } from '../components/settings/SpaceMembersManager';
import { SpaceCard } from '../components/ui/SpaceCard';
import { OrgChartView } from '../components/views/OrgChartView';
import type { Role } from '@spok/shared';
import { VIEW_MODES } from '../stores/viewMode';
import { useGoBack } from '../hooks/useGoBack';

// Vue ouverte par SpacePage quand l'espace n'a pas de vue par défaut
const FALLBACK_DEFAULT_VIEW = 'list';

// Choix « Héritée » de la visibilité (envoyé null à l'API : visibilité du parent, sinon de la communauté)
const INHERIT = 'INHERIT';
const VISIBILITY_LABELS: Record<string, string> = { OPEN: 'Ouvert', READONLY: 'Lecture seule', PRIVATE: 'Privé' };

export function SpaceSettingsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  // Retour : page d'où l'on vient (ex. liste admin des espaces), sinon l'espace
  const goBack = useGoBack(`/spaces/${spaceId}`);
  const user = useAuthStore((s) => s.user);
  const adminMode = useAdminMode();

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId!);
  const updateSpaceMutation = useUpdateSpace(spaceId!);
  const deleteSpaceMutation = useDeleteSpace();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'images' | 'members' | 'apercu' | 'danger'>('general');
  const [transferTargetId, setTransferTargetId] = useState('');
  const { pulseHelp, startTour: startSettingsTour } = usePageTourPulse('space-settings', PAGE_HELP['space-settings'].tour);

  const { data: spaceMembers } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId!),
    enabled: !!spaceId && space?.type === 'GROUP',
  });

  // Transfer ownership
  const transferOwnershipMutation = useMutation({
    mutationFn: (targetMemberId: string) => spacesApi.transferOwnership(spaceId!, targetMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setTransferTargetId('');
    },
  });

  // Quitter l'espace (membre direct sans droits de gestion) — un propriétaire passe par l'onglet Membres
  const isDirectMember = !!user && !!spaceMembers?.some((m) => m.userId === user.id);
  const leaveSpaceMutation = useMutation({
    mutationFn: () => spacesApi.leave(spaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      navigate(space?.communityId ? `/communities/${space.communityId}` : '/');
    },
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

  const handlePasteAvatar = useCallback((file: File) => uploadAvatarMutation.mutate(file), []); // eslint-disable-line react-hooks/exhaustive-deps
  usePasteUpload(true, handlePasteAvatar);

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

  const updateCoverCropMutation = useMutation({
    mutationFn: (data: { coverPosition: number; coverPositionX: number; coverZoom: number }) => spacesApi.update(spaceId!, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
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

  // Space info state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCommunityId, setEditCommunityId] = useState<string>('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [editDefaultRole, setEditDefaultRole] = useState<string>('');
  const [editVisibility, setEditVisibility] = useState<string>(INHERIT);
  const [editDefaultView, setEditDefaultView] = useState<string>(FALLBACK_DEFAULT_VIEW);


  // Initialize space info state
  useEffect(() => {
    if (space && !editName) {
      setEditName(space.name);
      setEditDescription(space.description || '');
      setEditCommunityId(space.communityId || '');
      setEditParentId(space.parentId || '');
      setEditDefaultRole(space.defaultRole || '');
      setEditVisibility(space.visibility || INHERIT);
      setEditDefaultView(space.defaultView || FALLBACK_DEFAULT_VIEW);
    }
  }, [space, editName]);

  const handleSaveSpaceInfo = async () => {
    if (!space) return;

    const updates: { name?: string; description?: string | null; communityId?: string | null; parentId?: string | null; defaultRole?: Role | null; visibility?: string | null; defaultView?: string | null } = {};
    if (editName !== space.name) updates.name = editName;
    if (editDescription !== (space.description || '')) updates.description = editDescription || null;
    const newCommunityId = editCommunityId || null;
    if (newCommunityId !== space.communityId) updates.communityId = newCommunityId;
    const newParentId = editParentId || null;
    if (newParentId !== (space.parentId || null)) updates.parentId = newParentId;
    const newDefaultRole = (editDefaultRole || null) as Role | null;
    if (newDefaultRole !== (space.defaultRole || null)) updates.defaultRole = newDefaultRole;
    if (editVisibility !== (space.visibility || INHERIT)) updates.visibility = editVisibility === INHERIT ? null : editVisibility;
    if (editDefaultView !== (space.defaultView || FALLBACK_DEFAULT_VIEW)) updates.defaultView = editDefaultView;

    if (Object.keys(updates).length > 0) {
      await updateSpaceMutation.mutateAsync(updates);
    }
  };

  const hasSpaceInfoChanges = space && (
    editName !== space.name ||
    editDescription !== (space.description || '') ||
    (editCommunityId || null) !== space.communityId ||
    (editParentId || null) !== (space.parentId || null) ||
    (editDefaultRole || null) !== (space.defaultRole || null) ||
    editVisibility !== (space.visibility || INHERIT) ||
    editDefaultView !== (space.defaultView || FALLBACK_DEFAULT_VIEW)
  );

  useCtrlS(!!hasSpaceInfoChanges && !updateSpaceMutation.isPending, handleSaveSpaceInfo);

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

    const eligible = allSpaces.filter(s =>
      s.type === 'GROUP' &&
      !excludeIds.has(s.id) &&
      (!editCommunityId || s.communityId === editCommunityId)
    );
    const groups = groupSpacesByCommunity(eligible).map(g => ({
      label: g.label,
      options: g.spaces.map(s => ({ value: s.id, label: s.name })),
    }));

    return {
      parentSpaceBaseOptions: [{ value: '', label: 'Aucun (espace racine)' }],
      parentSpaceGroups: groups,
    };
  }, [allSpaces, spaceId, editCommunityId]);

  // Check permissions
  const canEdit = space?.role === 'OWNER' || adminMode;

  // Check delete permission: space OWNER or community OWNER or admin
  const communityRole = communities?.find(c => c.id === space?.communityId)?.role;
  const canDelete = space?.role === 'OWNER' || communityRole === 'OWNER' || adminMode;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteSpace = async (deleteChildren: boolean) => {
    if (!space) return;
    try {
      await deleteSpaceMutation.mutateAsync({ id: space.id, deleteChildren });
      navigate(space.parentId ? `/spaces/${space.parentId}` : space.communityId ? `/communities/${space.communityId}` : '/');
    } catch {
      // Erreur affichée sous le bouton (deleteSpaceMutation.isError) — pas de rejet non géré
    }
  };

  if (spaceLoading) {
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
            to={`/spaces/${spaceId}`}
            className="text-yellow-700 underline hover:text-yellow-900 mt-2 inline-block"
          >
            Retour à l'espace
          </Link>
        </div>
        {/* Membre direct (non propriétaire) : il peut quitter l'espace d'ici */}
        {isDirectMember && (
          <div className="mt-4 border border-border rounded-lg p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Vous êtes membre de cet espace.</p>
            <Button
              variant="bordered"
              disabled={leaveSpaceMutation.isPending}
              onClick={() => { if (confirm('Quitter cet espace ? Vous perdrez l\'accès s\'il est privé.')) leaveSpaceMutation.mutate(); }}
            >
              Quitter l'espace
            </Button>
          </div>
        )}
        {leaveSpaceMutation.isError && (
          <p className="text-sm text-destructive mt-2">{(leaveSpaceMutation.error as any)?.message || 'Impossible de quitter l\'espace'}</p>
        )}
      </div>
    );
  }

  const tabs = [
    ...(space?.type === 'GROUP' ? [{ id: 'general' as const, label: 'Général' }] : []),
    { id: 'images' as const, label: 'Images' },
    ...(space?.type === 'GROUP' ? [{ id: 'members' as const, label: `Membres (${spaceMembers?.length || 0})` }] : []),
    { id: 'apercu' as const, label: 'Aperçu' },
    ...(canDelete ? [{ id: 'danger' as const, label: 'Danger' }] : []),
  ];

  return (
    <div className="p-6 overflow-auto flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          title="Retour"
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
        <div className="ml-auto"><HelpButton help={PAGE_HELP['space-settings']} onStartTour={startSettingsTour} pulse={pulseHelp} variant="page" buttonTitle="Aide" /></div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1" data-tour="space-settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              data-tour={`space-tab-${tab.id}`}
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
          <div className="bg-card border rounded-lg p-6" data-tour="space-general">
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
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Décrivez le contenu et l'objectif de cet espace..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Communauté</label>
                <Select
                  value={editCommunityId}
                  onChange={(e) => {
                    setEditCommunityId(e.target.value);
                    // Reset parent si le parent actuel n'est pas dans la nouvelle communauté
                    if (editParentId) {
                      const parentSpace = allSpaces?.find((s: any) => s.id === editParentId);
                      if (parentSpace && parentSpace.communityId !== (e.target.value || null)) {
                        setEditParentId('');
                      }
                    }
                  }}
                  options={communityOptions}
                />
                <FieldHelp page="space-settings" field="community" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Espace parent</label>
                <Select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  options={parentSpaceBaseOptions}
                  groups={parentSpaceGroups}
                />
                <FieldHelp page="space-settings" field="parent" />
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
                <FieldHelp page="space-settings" field="defaultRole" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Visibilité</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      value: INHERIT,
                      label: `Héritée — ${VISIBILITY_LABELS[(space as any).inheritedVisibility] ?? 'Privé'}`,
                      description: (space as any).inheritedFrom === 'parent'
                        ? "Suit la visibilité de l'espace parent"
                        : 'Suit la visibilité de la communauté',
                    },
                    { value: 'OPEN', label: 'Ouvert', description: 'Tous les membres de la communauté peuvent voir et modifier' },
                    { value: 'READONLY', label: 'Lecture seule', description: 'Les membres de la communauté peuvent voir, seuls les membres de l\'espace peuvent modifier' },
                    { value: 'PRIVATE', label: 'Privé', description: 'Seuls les membres de l\'espace ont accès' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditVisibility(opt.value)}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${
                        editVisibility === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.description}</div>
                    </button>
                  ))}
                </div>
                <FieldHelp page="space-settings" field="visibility" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vue par défaut</label>
                <Select
                  value={editDefaultView}
                  onChange={(e) => setEditDefaultView(e.target.value)}
                  options={VIEW_MODES.map((v) => ({ value: v.value, label: v.label }))}
                />
                <FieldHelp page="space-settings" field="defaultView" />
              </div>
              <Button
                onClick={handleSaveSpaceInfo}
                disabled={!hasSpaceInfoChanges || updateSpaceMutation.isPending}
                className={!hasSpaceInfoChanges ? 'opacity-40' : ''}
                size="sm"
              >
                {updateSpaceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* === IMAGES TAB === */}
        {activeTab === 'images' && (
          <div className="bg-card border rounded-lg p-6" data-tour="space-images">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Images
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Avatar + Cover upload */}
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
                      <FieldHelp page="space-settings" field="avatar" className="text-xs text-muted-foreground" />
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

                {/* Cover upload */}
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

              {/* Right: Cover position editor */}
              {space?.coverUrl && (
                <div>
                  <label className="block text-sm font-medium mb-2">Cadrage de la couverture</label>
                  <CoverPositionEditor
                    coverUrl={space.coverUrl}
                    position={(space as any).coverPosition ?? 50}
                    positionX={(space as any).coverPositionX ?? 50}
                    zoom={(space as any).coverZoom ?? 100}
                    onSave={(pos, posX, zm) => updateCoverCropMutation.mutate({ coverPosition: pos, coverPositionX: posX, coverZoom: zm })}
                  />
                </div>
              )}
            </div>

          </div>
        )}

        {/* === APERCU TAB === */}
        {activeTab === 'apercu' && space && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Aperçu des formats d'affichage</h2>
            <div className="max-w-[280px] pointer-events-none">
              <p className="text-sm font-medium mb-2">Carte (liste des espaces)</p>
              <SpaceCard space={space} showActions={false} />
            </div>
          </div>
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && space?.type === 'GROUP' && user && (
          <div className="bg-card border rounded-lg p-6 space-y-6" data-tour="space-members">
            <SpaceMembersManager
              spaceId={spaceId!}
              currentUserRole={canEdit ? 'OWNER' : (space.role || 'MEMBER')}
              currentUserId={user.id}
              spaceType={space.type}
              communityId={space.communityId}
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
          <div className="space-y-6" data-tour="space-danger">
            {/* Transfer ownership */}
            {space?.type === 'GROUP' && space.role === 'OWNER' && (
              <div className="border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5" />
                  Transférer la propriété
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Transférez la propriété de cet espace à un autre membre. Vous deviendrez simple membre.
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Nouveau propriétaire</label>
                    <Select
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                      options={[
                        { value: '', label: 'Sélectionner un membre...' },
                        ...(spaceMembers?.filter(m => m.userId !== user?.id).map(m => ({
                          value: m.id,
                          label: `${m.name} (${m.email})`,
                        })) || []),
                      ]}
                    />
                  </div>
                  <Button
                    variant="bordered"
                    onClick={() => {
                      if (transferTargetId && confirm('Êtes-vous sûr de vouloir transférer la propriété ? Cette action est irréversible.')) {
                        transferOwnershipMutation.mutate(transferTargetId);
                      }
                    }}
                    disabled={!transferTargetId || transferOwnershipMutation.isPending}
                  >
                    {transferOwnershipMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                    )}
                    Transférer
                  </Button>
                </div>
                {transferOwnershipMutation.isSuccess && (
                  <p className="text-sm text-green-600 mt-2">Propriété transférée avec succès.</p>
                )}
                {transferOwnershipMutation.isError && (
                  <p className="text-sm text-destructive mt-2">{(transferOwnershipMutation.error as any)?.message || 'Erreur lors du transfert'}</p>
                )}
              </div>
            )}

            {/* Delete space */}
            <div className="border border-destructive/30 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Supprimer l'espace
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                La suppression est irréversible. Tous les éléments, relations et contributions seront définitivement perdus.
              </p>
              <Button
                variant="bordered"
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
              {deleteSpaceMutation.isError && (
                <p className="text-sm text-destructive mt-2">{(deleteSpaceMutation.error as any)?.message || 'Erreur lors de la suppression'}</p>
              )}
            </div>
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


    </div>
  );
}

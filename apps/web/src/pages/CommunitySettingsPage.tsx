/* Paramètres communauté (/communities/:id/settings) : infos, visibilité, membres, référentiels, emails — OWNER. */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, FolderKanban, FolderOpen, Plus, Trash2, Loader2, Save, Camera, ImageIcon, Tag as TagIcon, Pencil, X, GripVertical, ChevronRight, Mail, Send, ChevronDown, RotateCw, HelpCircle, Play, AlertTriangle, ArrowRightLeft, Search, Users, FileText, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { COMMUNITY_SETTINGS_TOUR } from '../hooks/viewTours';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { ImageUploadZone } from '../components/ui/ImageUploadZone';
import { CoverPositionEditor } from '../components/ui/CoverPositionEditor';
import { usePasteUpload } from '../hooks/usePasteUpload';
import { useCtrlS } from '../hooks/useCtrlS';
import { communitiesApi, spacesApi } from '../lib/api';
import { SpaceDeleteConfirmModal } from '../components/SpaceDeleteConfirmModal';
import type { SpaceWithRole } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ConfirmModal } from '../components/ConfirmModal';
import { CommunityMembersManager } from '../components/settings/CommunityMembersManager';
import { CommunityCard, CommunityBanner } from '../components/ui/CommunityCard';
import { CommunityDeleteConfirmModal } from '../components/CommunityDeleteConfirmModal';
import { SendEmailModal } from '../components/SendEmailModal';
import { useAuthStore } from '../stores/auth';
import { RoleGuard } from '../components/RoleGuard';
import { useAdminMode } from '../components/DevDbStatus';
import { StatusManager } from '../components/settings/StatusManager';
import { TypeLabelsManager } from '../components/settings/TypeLabelsManager';
import { useCommunityReferentiels, useUpdateCommunityReferentiels, useResetCommunityReferentiels, useCheckCommunityStatusUsage } from '../hooks/useReferentiels';
import type { StatusConfig, TypeLabelConfig } from '@spok/shared';

function CommunitySettingsHelpButton({ pulse, onStartTour }: { pulse?: boolean; onStartTour: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const w = 320;
      let left = rect.right - w;
      if (left < 8) left = 8;
      setPos({ top: rect.bottom + 6, left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey); };
  }, [open]);

  const launchTour = () => {
    setOpen(false);
    setTimeout(onStartTour, 200);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-auto${pulse ? ' animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
        title="Aide"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div ref={popRef} className="fixed z-[200] w-[320px] rounded-lg border border-border bg-card shadow-lg" style={{ top: pos.top, left: pos.left }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h3 className="text-sm font-semibold">Paramètres de la communauté</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <p className="px-4 pb-2 text-xs text-muted-foreground leading-relaxed">
            Gérez votre communauté : informations, images, espaces, membres, tags et emails.
          </p>
          <ul className="px-4 pb-3 space-y-1">
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Général : nom, description et visibilité publique/privée</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Espaces : organisez la hiérarchie par glisser-déposer</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Membres : 3 colonnes (non-membres, membres, propriétaires)</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Emails : historique des envois, renvoi aux nouveaux membres</li>
          </ul>
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={launchTour}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Lancer le tutoriel interactif
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return date.toLocaleDateString('fr-FR');
}

function RootDropZone({ onMove }: { onMove: (spaceId: string, newParentId: string | null) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <tr
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
    >
      <td colSpan={7} className={`px-4 py-1 text-center text-xs transition-colors ${isDragOver ? 'text-primary bg-primary/5' : 'text-transparent select-none'}`}>
        {isDragOver ? 'Déposer ici pour mettre à la racine' : '.'}
      </td>
    </tr>
  );
}

function SpaceTableRow({ node, level, onMove, onDelete, canEdit }: {
  node: any;
  level: number;
  onMove: (spaceId: string, newParentId: string | null) => void;
  onDelete: (space: SpaceWithRole) => void;
  canEdit: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <tr
        draggable={canEdit}
        onDragStart={(e) => {
          if (!canEdit) return;
          e.dataTransfer.setData('application/spok-space-id', node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          if (!canEdit) return;
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
        className={`cursor-pointer transition-colors ${isDragOver ? 'bg-primary/5 ring-2 ring-inset ring-primary' : 'hover:bg-muted/50'}`}
        onClick={() => navigate(`/spaces/${node.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
            {canEdit && <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />}
            {node.avatarUrl ? (
              <img src={node.avatarUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
            ) : (
              <FolderOpen className="w-4 h-4 text-primary/60 flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate max-w-[220px]">{node.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
            node.type === 'GROUP'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {node.type === 'GROUP' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {node.type === 'GROUP' ? 'Groupe' : 'Perso'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {node.owner ? (
            <span className="truncate max-w-[120px] block">{node.owner.name}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            {node.memberCount ?? '—'}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            {node.itemCount ?? '—'}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(node.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}>
          {formatRelativeDate(node.createdAt)}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onDelete(node); }}
              className="h-7 w-7 p-0"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </td>
      </tr>
      {node.children?.map((child: any) => (
        <SpaceTableRow key={child.id} node={child} level={level + 1} onMove={onMove} onDelete={onDelete} canEdit={canEdit} />
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
  const [editVisibility, setEditVisibility] = useState<string>('PRIVATE');
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceToDelete, setSpaceToDelete] = useState<SpaceWithRole | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'images' | 'referentiels' | 'tags' | 'spaces' | 'members' | 'emails' | 'apercu' | 'danger'>('general');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const { pulseHelp, startTour: startSettingsTour } = usePageTourPulse('community-settings', COMMUNITY_SETTINGS_TOUR);

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

  // Referentiels
  const { data: referentielsData } = useCommunityReferentiels(communityId!);
  const updateRefMutation = useUpdateCommunityReferentiels(communityId!);
  const resetRefMutation = useResetCommunityReferentiels(communityId!);
  const checkRefUsageMutation = useCheckCommunityStatusUsage(communityId!);
  const [localStatuses, setLocalStatuses] = useState<StatusConfig[] | null>(null);
  const [localTypeLabels, setLocalTypeLabels] = useState<Record<string, TypeLabelConfig> | null>(null);
  const [refHasChanges, setRefHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description || '');
      setEditVisibility((community as any).visibility || (community.isPublic ? 'OPEN' : 'PRIVATE'));
    }
  }, [community]);

  // Initialize referentiels local state
  useEffect(() => {
    if (referentielsData && localStatuses === null) {
      setLocalStatuses(referentielsData.referentiels.statuses);
      setLocalTypeLabels(referentielsData.referentiels.typeLabels);
    }
  }, [referentielsData, localStatuses]);

  const handleRefSave = async () => {
    if (!localStatuses || !localTypeLabels) return;
    await updateRefMutation.mutateAsync({ statuses: localStatuses, typeLabels: localTypeLabels });
    setRefHasChanges(false);
  };

  const handleRefReset = async () => {
    const result = await resetRefMutation.mutateAsync();
    setLocalStatuses(result.referentiels.statuses);
    setLocalTypeLabels(result.referentiels.typeLabels);
    setRefHasChanges(false);
    setShowResetConfirm(false);
  };

  // Spaces in this community
  const communitySpaces = allSpaces?.filter(s => s.communityId === communityId) || [];

  const filteredSpaces = spaceSearch
    ? communitySpaces.filter(s => s.name.toLowerCase().includes(spaceSearch.toLowerCase()))
    : communitySpaces;

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
  const adminMode = useAdminMode();
  const canEdit = community?.role === 'OWNER' || community?.role === 'ADMIN_VIEW' || adminMode;

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


  // Delete space
  const deleteSpaceMutation = useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      spacesApi.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      setSpaceToDelete(null);
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

  // Delete community
  const deleteCommunityMutation = useMutation({
    mutationFn: (deleteChildren: boolean) => communitiesApi.delete(communityId!, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      navigate('/');
    },
  });

  // Transfer ownership
  const transferOwnershipMutation = useMutation({
    mutationFn: (targetMemberId: string) => communitiesApi.transferOwnership(communityId!, targetMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setTransferTargetId('');
    },
  });

  // Fetch members for transfer selector
  const { data: communityMembers } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId!),
    enabled: !!communityId && !!user,
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

  const handlePasteAvatar = useCallback((file: File) => uploadAvatarMutation.mutate(file), []); // eslint-disable-line react-hooks/exhaustive-deps
  usePasteUpload(true, handlePasteAvatar);

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

  const updateCoverCropMutation = useMutation({
    mutationFn: (data: { coverPosition: number; coverPositionX: number; coverZoom: number }) => communitiesApi.update(communityId!, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const hasInfoChanges = community && (
    editName !== community.name ||
    editDescription !== (community.description || '') ||
    editVisibility !== ((community as any)?.visibility || (community.isPublic ? 'OPEN' : 'PRIVATE'))
  );

  const handleSaveInfo = () => {
    const updates: { name?: string; description?: string; visibility?: string } = {};
    if (editName !== community?.name) updates.name = editName;
    if (editDescription !== (community?.description || '')) updates.description = editDescription;
    const currentVisibility = (community as any)?.visibility || (community?.isPublic ? 'OPEN' : 'PRIVATE');
    if (editVisibility !== currentVisibility && community?.role === 'OWNER') updates.visibility = editVisibility;
    if (Object.keys(updates).length > 0) {
      updateCommunityMutation.mutate(updates);
    }
  };

  useCtrlS(!!hasInfoChanges && !updateCommunityMutation.isPending, handleSaveInfo);

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
    <div className={`p-6 flex-1 min-h-0 ${activeTab === 'members' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
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
        <CommunitySettingsHelpButton pulse={pulseHelp} onStartTour={startSettingsTour} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1" data-tour="community-tabs">
          {([
            { id: 'general', label: 'Général' },
            ...(canEdit ? [{ id: 'images' as const, label: 'Images' }] : []),
            ...(canEdit ? [{ id: 'referentiels' as const, label: 'Référentiels' }] : []),
            ...(canEdit ? [{ id: 'tags' as const, label: 'Tags' }] : []),
            { id: 'spaces', label: `Espaces (${communitySpaces.length})` },
            { id: 'members', label: `Membres (${community.memberCount || 0})` },
            ...(canEdit ? [{ id: 'emails' as const, label: 'Emails' }] : []),
            { id: 'apercu' as const, label: 'Aperçu' },
            ...(canEdit ? [{ id: 'danger' as const, label: 'Danger' }] : []),
          ] as const).map(tab => (
            <button
              key={tab.id}
              data-tour={`community-tab-${tab.id}`}
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

      <div className={`${activeTab === 'members' ? 'flex flex-col flex-1 min-h-0' : 'space-y-8'}`}>
        {/* === GENERAL TAB === */}
        {activeTab === 'general' && (
          <>
            {/* Community info */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Informations</h2>

              {canEdit ? (
                <RoleGuard role="OWNER"><div className="space-y-4">
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
                    <div>
                      <label className="block text-sm font-medium mb-2">Visibilité</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'OPEN', label: 'Ouverte', description: 'Visible par tous, tout le monde peut rejoindre et contribuer' },
                          { value: 'READONLY', label: 'Lecture seule', description: 'Visible par tous, seuls les membres peuvent contribuer' },
                          { value: 'PRIVATE', label: 'Privée', description: 'Visible uniquement par les membres' },
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
                      disabled={!hasInfoChanges || updateCommunityMutation.isPending}
                      className={!hasInfoChanges ? 'opacity-40' : ''}
                    >
                      {updateCommunityMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Enregistrer
                    </Button>
                  </div>
                </div></RoleGuard>
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
                  <div><span className="text-muted-foreground">Visibilité:</span> <span className={`font-medium ${(community as any).visibility !== 'PRIVATE' ? 'text-green-600' : ''}`}>
                    {(community as any).visibility === 'OPEN' ? 'Ouverte' : (community as any).visibility === 'READONLY' ? 'Lecture seule' : 'Privée'}
                  </span></div>
                </div>
              )}
            </div>

          </>
        )}

        {/* === IMAGES TAB === */}
        {activeTab === 'images' && canEdit && (
          <RoleGuard role="OWNER"><div className="bg-card border rounded-lg p-6">
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

                {/* Cover upload */}
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

              {/* Right: Cover position editor */}
              {community.coverUrl && (
                <div>
                  <label className="block text-sm font-medium mb-2">Cadrage de la couverture</label>
                  <CoverPositionEditor
                    coverUrl={community.coverUrl}
                    position={(community as any).coverPosition ?? 50}
                    positionX={(community as any).coverPositionX ?? 50}
                    zoom={(community as any).coverZoom ?? 100}
                    onSave={(pos, posX, zm) => updateCoverCropMutation.mutate({ coverPosition: pos, coverPositionX: posX, coverZoom: zm })}
                  />
                </div>
              )}
            </div>

          </div></RoleGuard>
        )}

        {/* === APERCU TAB === */}
        {activeTab === 'apercu' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Aperçu des formats d'affichage</h2>
            <div className="max-w-[320px] space-y-6 pointer-events-none">
              <div>
                <p className="text-sm font-medium mb-2">Carte (liste des communautés)</p>
                <CommunityCard community={community} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Bannière (page activité)</p>
                <CommunityBanner community={community} />
              </div>
            </div>
          </div>
        )}

        {/* === REFERENTIELS TAB === */}
        {activeTab === 'referentiels' && canEdit && (
          <div className="space-y-6">
            {referentielsData?.isDefault && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  Cette communauté utilise les paramètres par défaut. Les modifications s'appliqueront à tous les espaces de la communauté.
                </p>
              </div>
            )}

            {refHasChanges && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">Modifications non enregistrées.</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="bordered" onClick={() => setShowResetConfirm(true)} disabled={resetRefMutation.isPending}>
                <RotateCw className="w-4 h-4 mr-2" />
                Réinitialiser
              </Button>
              <Button onClick={handleRefSave} disabled={!refHasChanges || updateRefMutation.isPending}>
                {updateRefMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Enregistrer
              </Button>
            </div>

            <div className="bg-card border rounded-lg p-6">
              {localStatuses && (
                <StatusManager
                  statuses={localStatuses}
                  onChange={(s) => { setLocalStatuses(s); setRefHasChanges(true); }}
                  onCheckUsage={(statusId) => checkRefUsageMutation.mutateAsync(statusId)}
                />
              )}
            </div>

            <div className="bg-card border rounded-lg p-6">
              {localTypeLabels && (
                <TypeLabelsManager
                  typeLabels={localTypeLabels}
                  onChange={(t) => { setLocalTypeLabels(t); setRefHasChanges(true); }}
                />
              )}
            </div>

            <ConfirmModal
              isOpen={showResetConfirm}
              onClose={() => setShowResetConfirm(false)}
              onConfirm={handleRefReset}
              title="Réinitialiser les référentiels ?"
              message="Tous les statuts et libellés de types seront rétablis aux valeurs par défaut pour cette communauté."
              confirmLabel="Réinitialiser"
              isPending={resetRefMutation.isPending}
            />
          </div>
        )}

        {/* === TAGS TAB === */}
        {activeTab === 'tags' && canEdit && (
          <RoleGuard role="OWNER">
            <CommunityTagsSection communityId={communityId!} />
          </RoleGuard>
        )}

        {/* === SPACES TAB === */}
        {activeTab === 'spaces' && (
          <div className="bg-card border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FolderKanban className="w-5 h-5" />
                Espaces ({communitySpaces.length})
              </h2>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setShowCreateSpace(!showCreateSpace); setShowAddSpace(false); }}>
                    <Plus className="w-4 h-4 mr-1" />
                    Créer un espace
                  </Button>
                  {availableSpaces.length > 0 && (
                    <Button size="sm" variant="bordered" onClick={() => { setShowAddSpace(!showAddSpace); setShowCreateSpace(false); }}>
                      Rattacher un espace existant
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Create space form */}
            {showCreateSpace && (
              <div className="px-6 py-4 bg-muted/50 border-b space-y-3">
                <p className="text-sm text-muted-foreground">Créer un nouvel espace dans cette communauté :</p>
                <Input
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Nom de l'espace"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newSpaceName.trim()) createSpaceMutation.mutate(newSpaceName.trim()); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => createSpaceMutation.mutate(newSpaceName.trim())} disabled={!newSpaceName.trim() || createSpaceMutation.isPending}>
                    {createSpaceMutation.isPending ? 'Création...' : 'Créer'}
                  </Button>
                  <Button size="sm" variant="bordered" onClick={() => { setShowCreateSpace(false); setNewSpaceName(''); }}>Annuler</Button>
                </div>
              </div>
            )}

            {/* Add space form */}
            {showAddSpace && (
              <div className="px-6 py-4 bg-muted/50 border-b space-y-3">
                <p className="text-sm text-muted-foreground">Sélectionnez un espace de groupe à rattacher à cette communauté :</p>
                <Select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  options={[{ value: '', label: 'Choisir un espace...' }, ...availableSpaces.map(s => ({ value: s.id, label: s.name }))]}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddSpace} disabled={!selectedSpaceId || addSpaceMutation.isPending}>
                    {addSpaceMutation.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                  <Button size="sm" variant="bordered" onClick={() => { setShowAddSpace(false); setSelectedSpaceId(''); }}>Annuler</Button>
                </div>
              </div>
            )}

            {/* Search bar */}
            <div className="px-4 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={spaceSearch}
                  onChange={(e) => setSpaceSearch(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="pl-10"
                />
                {spaceSearch && (
                  <button onClick={() => setSpaceSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Espace</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Propriétaire</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Membres</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Créé</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {communitySpaces.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucun espace rattaché à cette communauté.
                      </td>
                    </tr>
                  ) : spaceSearch ? (
                    filteredSpaces.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Aucun espace trouvé pour &laquo;&nbsp;{spaceSearch}&nbsp;&raquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredSpaces.map(space => (
                        <SpaceTableRow key={space.id} node={{ ...space, children: [] }} level={0} onMove={handleMoveSpace} onDelete={setSpaceToDelete} canEdit={canEdit} />
                      ))
                    )
                  ) : (
                    <>
                      {canEdit && <RootDropZone onMove={handleMoveSpace} />}
                      {spaceTree.map(node => (
                        <SpaceTableRow key={node.id} node={node} level={0} onMove={handleMoveSpace} onDelete={setSpaceToDelete} canEdit={canEdit} />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {canEdit && availableSpaces.length === 0 && communitySpaces.length > 0 && (
              <p className="text-xs text-muted-foreground px-4 py-2 border-t">
                Tous vos espaces de groupe sont déjà rattachés à une communauté.
              </p>
            )}
          </div>
        )}

        {spaceToDelete && (
          <SpaceDeleteConfirmModal
            isOpen={!!spaceToDelete}
            onClose={() => setSpaceToDelete(null)}
            onConfirm={(deleteChildren) => deleteSpaceMutation.mutate({ id: spaceToDelete.id, deleteChildren })}
            spaceId={spaceToDelete.id}
            spaceName={spaceToDelete.name}
            isPending={deleteSpaceMutation.isPending}
          />
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && user && (
          <div className="bg-card border rounded-lg p-6 flex-1 min-h-0 flex flex-col">
            <CommunityMembersManager
              communityId={communityId!}
              currentUserRole={community.role || 'MEMBER'}
              currentUserId={user.id}
            />
          </div>
        )}

        {/* === EMAILS TAB === */}
        {activeTab === 'emails' && user && communityId && (
          <CommunityEmailsSection communityId={communityId} />
        )}

        {/* === DANGER TAB === */}
        {activeTab === 'danger' && canEdit && (
          <div className="space-y-6">
            {/* Transfer ownership */}
            <div className="border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Transférer la propriété
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Transférez la propriété de cette communauté à un autre membre. Vous deviendrez simple membre.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Nouveau propriétaire</label>
                  <Select
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    options={[
                      { value: '', label: 'Sélectionner un membre...' },
                      ...(communityMembers?.filter(m => m.userId !== user?.id).map(m => ({
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

            {/* Delete community */}
            <div className="border border-destructive/30 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Supprimer la communauté
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                La suppression est irréversible. Tous les membres perdront leur accès. Les espaces peuvent être conservés ou supprimés.
              </p>
              <Button
                variant="bordered"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteCommunityMutation.isPending}
              >
                {deleteCommunityMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Supprimer cette communauté
              </Button>
            </div>

            <CommunityDeleteConfirmModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={(deleteChildren) => {
                setShowDeleteModal(false);
                deleteCommunityMutation.mutate(deleteChildren);
              }}
              communityId={communityId!}
              communityName={community.name}
              isPending={deleteCommunityMutation.isPending}
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

// ==================== Emails Section ====================

function CommunityEmailsSection({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const { data: emails, isLoading } = useQuery({
    queryKey: ['community-emails', communityId],
    queryFn: () => communitiesApi.listEmails(communityId),
  });

  const { data: emailDetail } = useQuery({
    queryKey: ['community-email', communityId, expandedId],
    queryFn: () => communitiesApi.getEmail(communityId, expandedId!),
    enabled: !!expandedId,
  });

  const { data: members } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId),
  });

  const resendMutation = useMutation({
    mutationFn: ({ emailId, recipientIds }: { emailId: string; recipientIds: string[] }) =>
      communitiesApi.resendEmail(communityId, emailId, recipientIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-emails', communityId] });
      queryClient.invalidateQueries({ queryKey: ['community-email', communityId] });
    },
  });

  // Members who haven't received the expanded email
  const newRecipients = useMemo(() => {
    if (!emailDetail || !members) return [];
    const alreadySent = new Set(emailDetail.recipients.map(r => r.userId));
    return members.filter(m => !alreadySent.has(m.userId));
  }, [emailDetail, members]);

  const community = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId),
  }).data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emailMembers = (members || []).map(m => ({ userId: m.userId, name: m.name, email: m.email }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Emails</h3>
        </div>
        <Button size="sm" onClick={() => setShowSendModal(true)}>
          <Send className="w-4 h-4 mr-1" />
          Nouvel email
        </Button>
      </div>

      {showSendModal && community && (
        <SendEmailModal
          isOpen={showSendModal}
          onClose={() => { setShowSendModal(false); queryClient.invalidateQueries({ queryKey: ['community-emails', communityId] }); }}
          members={emailMembers}
          target={{ type: 'community', id: community.id, name: community.name }}
        />
      )}

      {!emails || emails.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Aucun email envoyé pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {emails.map(email => {
            const isExpanded = expandedId === email.id;
            return (
              <div key={email.id} className="border border-border rounded-lg overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(email.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{email.sentBy.name}
                      {' · '}{email.recipientCount} destinataire{email.recipientCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && emailDetail && emailDetail.id === email.id && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Preview */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Contenu</p>
                      <div
                        className="text-sm bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto prose prose-sm dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: emailDetail.html }}
                      />
                    </div>

                    {/* Recipients list */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Déjà envoyé ({emailDetail.recipients.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {emailDetail.recipients.map(r => (
                          <button
                            key={r.userId}
                            onClick={() => {
                              resendMutation.mutate({
                                emailId: email.id,
                                recipientIds: [r.userId],
                              });
                            }}
                            disabled={resendMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
                            title={`Renvoyer à ${r.name}`}
                          >
                            <RotateCw className="w-3 h-3" />
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resend to new members */}
                    {newRecipients.length > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm">
                            <span className="font-medium">{newRecipients.length}</span> membre{newRecipients.length > 1 ? 's' : ''} n'ont pas reçu cet email
                          </p>
                          <Button
                            size="sm"
                            variant="bordered"
                            onClick={() => {
                              resendMutation.mutate({
                                emailId: email.id,
                                recipientIds: newRecipients.map(m => m.userId),
                              });
                            }}
                            disabled={resendMutation.isPending}
                          >
                            {resendMutation.isPending ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Envoi...</>
                            ) : (
                              <><Send className="w-3.5 h-3.5 mr-1.5" />Envoyer à tous</>
                            )}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {newRecipients.map(m => (
                            <button
                              key={m.userId}
                              onClick={() => {
                                resendMutation.mutate({
                                  emailId: email.id,
                                  recipientIds: [m.userId],
                                });
                              }}
                              disabled={resendMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer disabled:opacity-50"
                              title={`Envoyer à ${m.name}`}
                            >
                              <Send className="w-3 h-3" />
                              {m.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Users, FileText, Plus, X, Building2, User, LogIn, LogOut, Trash2, ChevronRight, Settings, FolderInput, FolderPlus, LayoutGrid } from 'lucide-react';
import { spacesApi, communitiesApi } from '../lib/api';
import { useCommunityStore } from '../stores/community';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { SpaceWithRole } from '@spok/shared';
import { SPACE_TEMPLATES } from '@spok/shared';
import { GraphView } from '../components/views/GraphView';
import { SunburstView } from '../components/views/SunburstView';
import { ConfirmModal } from '../components/ConfirmModal';
import { SpaceDeleteConfirmModal } from '../components/SpaceDeleteConfirmModal';
import { DashboardMindMapView } from '../components/views/DashboardMindMapView';
import { ItemActionMenu } from '../components/ui/ItemActionMenu';
import type { ItemActionGroup } from '../components/ui/ItemActionMenu';
import { useDashboardTabStore } from '../stores/dashboardTab';
import { CommunityListView } from '../components/views/CommunityListView';
import { MyOrganizationView } from '../components/views/MyOrganizationView';
import { DashboardCockpitView } from '../components/views/DashboardCockpitView';
import { HomeView } from '../components/views/HomeView';
import { useDashboardOnboarding } from '../hooks/useOnboarding';
import { DashboardToolbar } from '../components/DashboardToolbar';

interface SpaceTreeNode extends SpaceWithRole {
  children: SpaceTreeNode[];
}

function buildSpaceTree(spaces: SpaceWithRole[]): SpaceTreeNode[] {
  const map = new Map<string, SpaceTreeNode>();
  const roots: SpaceTreeNode[] = [];

  spaces.forEach(s => map.set(s.id, { ...s, children: [] }));
  spaces.forEach(s => {
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(map.get(s.id)!);
    } else {
      roots.push(map.get(s.id)!);
    }
  });

  return roots;
}

// Renders a space card with indented sub-spaces below it
function SpaceCardWithChildren({
  node,
  onJoin,
  onLeave,
  onDelete,
  onAddChildSpace,
  onMoveToParent,
  communityRoles,
  level = 0,
}: {
  node: SpaceTreeNode;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
  onDelete?: (id: string, deleteChildren: boolean) => void;
  onAddChildSpace?: (parentId: string) => void;
  onMoveToParent?: (spaceId: string, newParentId: string) => void;
  communityRoles?: Map<string, string>;
  level?: number;
}) {
  const canDelete = node.role === 'OWNER' || (
    node.communityId && communityRoles?.get(node.communityId) &&
    communityRoles.get(node.communityId) === 'OWNER'
  );

  return (
    <>
      {level === 0 ? (
        <SpaceCard space={node} onJoin={onJoin} onLeave={onLeave} onDelete={onDelete} canDelete={!!canDelete} onAddChildSpace={onAddChildSpace} onMoveToParent={onMoveToParent} />
      ) : (
        <Link
          to={`/spaces/${node.id}/content`}
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{node.name}</span>
          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
            {node.itemCount || 0} el.
          </span>
        </Link>
      )}
      {node.children.map((child) => (
        <SpaceCardWithChildren key={child.id} node={child} onJoin={onJoin} onLeave={onLeave} onDelete={onDelete} onAddChildSpace={onAddChildSpace} onMoveToParent={onMoveToParent} communityRoles={communityRoles} level={level + 1} />
      ))}
    </>
  );
}

// Reusable space card component
function SpaceCard({ space, onJoin, onLeave, onDelete, canDelete, onAddChildSpace, onMoveToParent }: { space: SpaceWithRole; onJoin?: (id: string) => void; onLeave?: (id: string) => void; onDelete?: (id: string, deleteChildren: boolean) => void; canDelete?: boolean; onAddChildSpace?: (parentId: string) => void; onMoveToParent?: (spaceId: string, newParentId: string) => void }) {
  const navigate = useNavigate();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isMember = space.isMember !== false;
  const canLeave = isMember && space.role !== 'OWNER' && space.type !== 'PERSONAL';
  const canManage = isMember && space.role === 'OWNER';

  // Build action menu groups
  const actionGroups = useMemo(() => {
    if (!isMember) return [];
    const groups: ItemActionGroup[] = [];

    // Navigation actions
    const navActions: ItemActionGroup['actions'] = [];
    navActions.push({
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
      onClick: () => navigate(`/spaces/${space.id}/settings`),
    });
    if (space.type === 'GROUP' && onAddChildSpace) {
      navActions.push({
        id: 'add-child',
        label: 'Ajouter un sous-espace',
        icon: FolderPlus,
        onClick: () => onAddChildSpace(space.id),
      });
    }
    if (canManage && space.type === 'GROUP') {
      navActions.push({
        id: 'move',
        label: 'Déplacer',
        icon: FolderInput,
        onClick: () => navigate(`/spaces/${space.id}/settings`),
      });
    }
    groups.push({ actions: navActions });

    // Danger actions
    const dangerActions: ItemActionGroup['actions'] = [];
    if (canLeave && onLeave) {
      dangerActions.push({
        id: 'leave',
        label: 'Quitter',
        icon: LogOut,
        onClick: () => setShowLeaveModal(true),
        variant: 'danger',
      });
    }
    if (canDelete && onDelete) {
      dangerActions.push({
        id: 'delete',
        label: 'Supprimer',
        icon: Trash2,
        onClick: () => setShowDeleteModal(true),
        variant: 'danger',
      });
    }
    if (dangerActions.length > 0) {
      groups.push({ actions: dangerActions });
    }

    return groups;
  }, [space, isMember, canLeave, canDelete, canManage, navigate, onLeave, onDelete, onAddChildSpace]);

  const isDraggable = isMember;
  const isDropTarget = !!onMoveToParent;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/spok-space-id', space.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDropTarget) return;
    const draggedId = e.dataTransfer.types.includes('application/spok-space-id');
    if (draggedId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedSpaceId = e.dataTransfer.getData('application/spok-space-id');
    if (draggedSpaceId && draggedSpaceId !== space.id && onMoveToParent) {
      onMoveToParent(draggedSpaceId, space.id);
    }
  };

  const cardContent = (
    <Card className={`group transition-colors h-full overflow-hidden ${isMember ? 'hover:border-primary/50 cursor-pointer' : 'opacity-75 border-dashed'} ${isDragOver ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}>
      {space.coverUrl && (
        <div className="h-24 overflow-hidden">
          <img src={space.coverUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {space.avatarUrl ? (
              <img src={space.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <FolderKanban className={`w-5 h-5 flex-shrink-0 ${isMember ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
            <CardTitle className="text-lg truncate">{space.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isMember ? (
              <Badge variant={space.type === 'PERSONAL' ? 'secondary' : 'outline'}>
                {space.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Non rejoint</Badge>
            )}
            {isMember && actionGroups.length > 0 && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ItemActionMenu
                  groups={actionGroups}
                  triggerClassName="p-1 rounded hover:bg-accent transition-colors"
                />
              </div>
            )}
          </div>
        </div>
        <CardDescription>
          {isMember
            ? (space.role === 'OWNER' ? 'Propriétaire' : space.role)
            : null
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {space.type === 'GROUP' && (
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {space.memberCount} membre{(space.memberCount || 0) > 1 ? 's' : ''}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {space.itemCount || 0} élément{(space.itemCount || 0) > 1 ? 's' : ''}
          </span>
        </div>
        {!isMember && onJoin && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJoin(space.id);
            }}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Rejoindre
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const leaveModal = canLeave && onLeave && (
    <ConfirmModal
      isOpen={showLeaveModal}
      onClose={() => setShowLeaveModal(false)}
      onConfirm={() => {
        onLeave(space.id);
        setShowLeaveModal(false);
      }}
      title="Quitter l'espace"
      message={`Vous êtes sur le point de quitter l'espace « ${space.name} ».`}
      confirmLabel="Quitter"
      icon="leave"
    />
  );

  const deleteModal = canDelete && onDelete && (
    <SpaceDeleteConfirmModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={(deleteChildren) => {
        onDelete(space.id, deleteChildren);
        setShowDeleteModal(false);
      }}
      spaceId={space.id}
      spaceName={space.name}
    />
  );

  const dragDropProps = {
    draggable: isDraggable,
    onDragStart: isDraggable ? handleDragStart : undefined,
    onDragOver: isDropTarget ? handleDragOver : undefined,
    onDragLeave: isDropTarget ? handleDragLeave : undefined,
    onDrop: isDropTarget ? handleDrop : undefined,
  };

  if (isMember) {
    return <div {...dragDropProps}>{leaveModal}{deleteModal}<Link to={`/spaces/${space.id}/content`}>{cardContent}</Link></div>;
  }

  return <div {...dragDropProps}>{leaveModal}{deleteModal}{cardContent}</div>;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewSpace = searchParams.get('new') === 'space';
  const { currentCommunity } = useCommunityStore();
  const { tab } = useDashboardTabStore();
  const { startDashboardTour } = useDashboardOnboarding(tab);

  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<'PERSONAL' | 'GROUP'>('GROUP');
  const [newSpaceCommunityId, setNewSpaceCommunityId] = useState<string>(currentCommunity?.id || '');
  const [newSpaceParentId, setNewSpaceParentId] = useState<string>('');
  const [newSpaceTemplateId, setNewSpaceTemplateId] = useState<string>('blank');
  const [leavingCommunity, setLeavingCommunity] = useState<{ id: string; name: string } | null>(null);

  // Pre-select current community when the form opens
  useEffect(() => {
    if (showNewSpace && newSpaceType === 'GROUP' && currentCommunity) {
      setNewSpaceCommunityId(currentCommunity.id);
    }
  }, [showNewSpace, currentCommunity]);

  // Fetch ALL spaces (no community filter) for segmented display
  const { data: allSpaces, isLoading } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  // Segment spaces into categories
  const { personalSpaces, communityGroups, independentSpaces } = useMemo(() => {
    if (!allSpaces) return { personalSpaces: [], communityGroups: [] as { communityId: string; communityName: string; spaces: SpaceWithRole[] }[], independentSpaces: [] };

    const personal = allSpaces.filter(s => s.type === 'PERSONAL');
    const independent = allSpaces.filter(s => s.type === 'GROUP' && !s.communityId);

    // Group by community
    const byCommunity = new Map<string, { communityName: string; spaces: SpaceWithRole[] }>();
    for (const space of allSpaces) {
      if (space.type === 'GROUP' && space.communityId && space.community) {
        const existing = byCommunity.get(space.communityId);
        if (existing) {
          existing.spaces.push(space);
        } else {
          byCommunity.set(space.communityId, {
            communityName: space.community.name,
            spaces: [space],
          });
        }
      }
    }

    const groups = Array.from(byCommunity.entries())
      .map(([communityId, { communityName, spaces }]) => ({ communityId, communityName, spaces }))
      .sort((a, b) => a.communityName.localeCompare(b.communityName));

    return { personalSpaces: personal, communityGroups: groups, independentSpaces: independent };
  }, [allSpaces]);

  // Join space mutation
  const joinSpaceMutation = useMutation({
    mutationFn: spacesApi.join,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const handleJoinSpace = (spaceId: string) => {
    joinSpaceMutation.mutate(spaceId);
  };

  // Leave space mutation
  const leaveSpaceMutation = useMutation({
    mutationFn: spacesApi.leave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const handleLeaveSpace = (spaceId: string) => {
    leaveSpaceMutation.mutate(spaceId);
  };

  // Delete space mutation
  const deleteSpaceMutation = useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      spacesApi.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const handleDeleteSpace = (spaceId: string, deleteChildren: boolean) => {
    deleteSpaceMutation.mutate({ id: spaceId, deleteChildren });
  };

  const handleAddChildSpace = (parentId: string) => {
    setNewSpaceType('GROUP');
    setNewSpaceParentId(parentId);
    setSearchParams({ new: 'space' });
  };

  // Move space to new parent (drag & drop) or remove parent (null)
  const moveToParentMutation = useMutation({
    mutationFn: ({ spaceId, parentId }: { spaceId: string; parentId: string | null }) =>
      spacesApi.update(spaceId, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
    onError: (error) => {
      alert(`Erreur: ${error.message}`);
    },
  });

  const handleMoveToParent = (spaceId: string, newParentId: string | null) => {
    moveToParentMutation.mutate({ spaceId, parentId: newParentId });
  };

  // Fetch communities for the select dropdown
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  // Build community role map for delete permission check
  const communityRoles = useMemo(() => {
    const map = new Map<string, string>();
    communities?.forEach(c => {
      if (c.role) map.set(c.id, c.role);
    });
    return map;
  }, [communities]);

  const createSpaceMutation = useMutation({
    mutationFn: spacesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      setNewSpaceName('');
      setSearchParams({});
    },
    onError: (error) => {
      console.error('Failed to create space:', error);
      alert(`Erreur: ${error.message}`);
    },
  });

  const handleCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSpaceName.trim()) {
      createSpaceMutation.mutate({
        name: newSpaceName,
        type: newSpaceType,
        communityId: newSpaceType === 'GROUP' && newSpaceCommunityId ? newSpaceCommunityId : undefined,
        parentId: newSpaceType === 'GROUP' && newSpaceParentId ? newSpaceParentId : undefined,
        templateId: newSpaceTemplateId !== 'blank' ? newSpaceTemplateId : undefined,
      });
    }
  };

  const closeNewSpaceForm = () => {
    setSearchParams({});
    setNewSpaceName('');
    setNewSpaceCommunityId('');
    setNewSpaceParentId('');
    setNewSpaceTemplateId('blank');
  };

  // When space type changes, reset community/parent if personal
  const handleTypeChange = (type: 'PERSONAL' | 'GROUP') => {
    setNewSpaceType(type);
    if (type === 'PERSONAL') {
      setNewSpaceCommunityId('');
      setNewSpaceParentId('');
    } else if (currentCommunity) {
      // Pre-select the current community when creating a GROUP space
      setNewSpaceCommunityId(currentCommunity.id);
    }
  };

  // Build community options for select
  const communityOptions = [
    { value: '', label: 'Aucune (espace independant)' },
    ...(communities?.map(c => ({ value: c.id, label: c.name })) || []),
  ];

  // Build parent space options (only GROUP spaces the user has access to)
  const parentSpaceOptions = useMemo(() => {
    const groupSpaces = (allSpaces || []).filter(s => s.type === 'GROUP');
    return [
      { value: '', label: 'Aucun (espace racine)' },
      ...groupSpaces.map(s => ({ value: s.id, label: s.name })),
    ];
  }, [allSpaces]);

  return (
    <div className={`flex flex-col${tab === 'graph' || tab === 'sunburst' || tab === 'mindmap' || tab === 'planning' || tab === 'dashboard' ? ' h-full overflow-hidden' : ''}`}>
      <DashboardToolbar tab={tab} onStartTour={() => startDashboardTour(tab)} />
      {tab === 'home' ? (
        <HomeView />
      ) : tab === 'communities' ? (
        <CommunityListView />
      ) : tab === 'dashboard' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <DashboardCockpitView />
        </div>
      ) : tab === 'planning' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <MyOrganizationView />
        </div>
      ) : tab === 'graph' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <GraphView
            level="global"
            onNodeClick={(itemId, spaceId) => navigate(`/spaces/${spaceId}/content`, { state: { openItemId: itemId } })}
          />
        </div>
      ) : tab === 'sunburst' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <SunburstView />
        </div>
      ) : tab === 'mindmap' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <DashboardMindMapView
            communityGroups={communityGroups}
            personalSpaces={personalSpaces}
            independentSpaces={independentSpaces}
            onMoveSpace={handleMoveToParent}
          />
        </div>
      ) : (
      <div className="p-8 flex-1">
      <div className="max-w-6xl mx-auto">
        {/* Action bar */}
        <div className="flex items-center justify-end mb-6">
          <Button onClick={() => setSearchParams({ new: 'space' })}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel espace
          </Button>
        </div>

        {/* New space form */}
        {showNewSpace && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Créer un espace</CardTitle>
                <Button variant="ghost" size="icon" onClick={closeNewSpaceForm} title="Fermer">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSpace} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de l'espace</label>
                  <Input
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="Mon nouveau projet"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {SPACE_TEMPLATES.map((tpl) => {
                      const IconMap: Record<string, typeof FileText> = { FileText, FolderKanban, LayoutGrid, Users };
                      const TplIcon = IconMap[tpl.icon] || FileText;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setNewSpaceTemplateId(tpl.id)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                            newSpaceTemplateId === tpl.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-accent/50'
                          }`}
                        >
                          <TplIcon className={`w-5 h-5 ${newSpaceTemplateId === tpl.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${newSpaceTemplateId === tpl.id ? 'text-primary' : ''}`}>{tpl.name}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{tpl.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="spaceType"
                        checked={newSpaceType === 'GROUP'}
                        onChange={() => handleTypeChange('GROUP')}
                      />
                      <span className="text-sm">Groupe (collaboratif)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="spaceType"
                        checked={newSpaceType === 'PERSONAL'}
                        onChange={() => handleTypeChange('PERSONAL')}
                      />
                      <span className="text-sm">Personnel</span>
                    </label>
                  </div>
                </div>

                {newSpaceType === 'GROUP' && communities && communities.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Communaute</label>
                    <Select
                      value={newSpaceCommunityId}
                      onChange={(e) => setNewSpaceCommunityId(e.target.value)}
                      options={communityOptions}
                    />
                    <p className="text-xs text-muted-foreground">
                      Associer cet espace a une communaute pour le partager avec ses membres.
                    </p>
                  </div>
                )}

                {newSpaceType === 'GROUP' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Espace parent</label>
                    <Select
                      value={newSpaceParentId}
                      onChange={(e) => setNewSpaceParentId(e.target.value)}
                      options={parentSpaceOptions}
                    />
                    <p className="text-xs text-muted-foreground">
                      Imbriquer cet espace sous un autre espace de groupe.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={createSpaceMutation.isPending}>
                    {createSpaceMutation.isPending ? 'Création...' : 'Créer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeNewSpaceForm}>
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Spaces sections */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement...
          </div>
        ) : allSpaces?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun espace</h3>
              <p className="text-muted-foreground mb-4">
                Créez votre premier espace pour commencer
              </p>
              <Button onClick={() => setSearchParams({ new: 'space' })}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un espace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Personal spaces */}
            {personalSpaces.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Espaces personnels</h2>
                  <Badge variant="secondary" className="ml-1">{personalSpaces.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {personalSpaces.map((space) => (
                    <SpaceCard key={space.id} space={space} onDelete={handleDeleteSpace} canDelete={space.role === 'OWNER'} />
                  ))}
                </div>
              </section>
            )}

            {/* Community groups */}
            {communityGroups.map((group) => {
              const tree = buildSpaceTree(group.spaces);
              const communityRole = communityRoles.get(group.communityId);
              const isCommunityOwnerOrAdmin = communityRole === 'OWNER';
              const communityActionGroups: ItemActionGroup[] = [];

              // Navigation actions
              const communityNavActions: ItemActionGroup['actions'] = [];
              if (isCommunityOwnerOrAdmin) {
                communityNavActions.push({
                  id: 'community-settings',
                  label: 'Paramètres',
                  icon: Settings,
                  onClick: () => navigate(`/communities/${group.communityId}/settings`),
                });
              }
              communityNavActions.push({
                id: 'community-add-space',
                label: 'Ajouter un espace',
                icon: FolderPlus,
                onClick: () => {
                  setNewSpaceType('GROUP');
                  setNewSpaceCommunityId(group.communityId);
                  setNewSpaceParentId('');
                  setSearchParams({ new: 'space' });
                },
              });
              if (communityNavActions.length > 0) {
                communityActionGroups.push({ actions: communityNavActions });
              }

              // Danger actions
              const communityDangerActions: ItemActionGroup['actions'] = [];
              if (communityRole && communityRole !== 'OWNER') {
                communityDangerActions.push({
                  id: 'community-leave',
                  label: 'Quitter',
                  icon: LogOut,
                  onClick: () => {
                    setLeavingCommunity({ id: group.communityId, name: group.communityName });
                  },
                  variant: 'danger',
                });
              }
              if (communityDangerActions.length > 0) {
                communityActionGroups.push({ actions: communityDangerActions });
              }

              return (
                <section key={group.communityId}>
                  <div className="group/community flex items-center gap-2 mb-4">
                    {group.spaces[0]?.community?.avatarUrl ? (
                      <img src={group.spaces[0].community.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h2 className="text-lg font-semibold">{group.communityName}</h2>
                    <Badge variant="outline" className="ml-1">{group.spaces.length}</Badge>
                    {communityActionGroups.length > 0 && (
                      <div className="opacity-0 group-hover/community:opacity-100 transition-opacity">
                        <ItemActionMenu
                          groups={communityActionGroups}
                          triggerClassName="p-1 rounded hover:bg-accent transition-colors"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tree.map((node) => (
                      <div key={node.id}>
                        <SpaceCardWithChildren node={node} onJoin={handleJoinSpace} onLeave={handleLeaveSpace} onDelete={handleDeleteSpace} onAddChildSpace={handleAddChildSpace} onMoveToParent={handleMoveToParent} communityRoles={communityRoles} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Independent group spaces (no community) */}
            {independentSpaces.length > 0 && (() => {
              const tree = buildSpaceTree(independentSpaces);
              return (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Espaces de groupe</h2>
                    <Badge variant="outline" className="ml-1">{independentSpaces.length}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tree.map((node) => (
                      <div key={node.id}>
                        <SpaceCardWithChildren node={node} onDelete={handleDeleteSpace} onAddChildSpace={handleAddChildSpace} onMoveToParent={handleMoveToParent} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>
        )}
      </div>
      </div>
      )}

      <ConfirmModal
        isOpen={!!leavingCommunity}
        onClose={() => setLeavingCommunity(null)}
        onConfirm={() => {
          if (leavingCommunity) {
            communitiesApi.leave(leavingCommunity.id).then(() => {
              queryClient.invalidateQueries({ queryKey: ['communities'] });
              queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
            });
          }
          setLeavingCommunity(null);
        }}
        title="Quitter cette communauté ?"
        message={`Quitter la communauté « ${leavingCommunity?.name} » ?`}
        confirmLabel="Quitter"
        icon="leave"
      />
    </div>
  );
}

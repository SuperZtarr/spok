import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Users, FileText, Plus, X, Building2, User, LogIn, LogOut, Trash2, Network, CircleDot, ChevronRight, CheckSquare } from 'lucide-react';
import { spacesApi, communitiesApi } from '../lib/api';
import { useCommunityStore } from '../stores/community';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { SpaceWithRole } from '@spok/shared';
import { GraphView } from '../components/views/GraphView';
import { SunburstView } from '../components/views/SunburstView';
import { ConfirmModal } from '../components/ConfirmModal';

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
  communityRoles,
  level = 0,
}: {
  node: SpaceTreeNode;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
  communityRoles?: Map<string, string>;
  level?: number;
}) {
  const canDelete = node.role === 'OWNER' || (
    node.communityId && communityRoles?.get(node.communityId) &&
    ['OWNER', 'ADMIN'].includes(communityRoles.get(node.communityId)!)
  );

  return (
    <>
      {level === 0 ? (
        <SpaceCard space={node} onJoin={onJoin} onLeave={onLeave} onDelete={onDelete} canDelete={!!canDelete} />
      ) : (
        <Link
          to={`/spaces/${node.id}`}
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
        <SpaceCardWithChildren key={child.id} node={child} onJoin={onJoin} onLeave={onLeave} onDelete={onDelete} communityRoles={communityRoles} level={level + 1} />
      ))}
    </>
  );
}

// Reusable space card component
function SpaceCard({ space, onJoin, onLeave, onDelete, canDelete }: { space: SpaceWithRole; onJoin?: (id: string) => void; onLeave?: (id: string) => void; onDelete?: (id: string, name: string) => void; canDelete?: boolean }) {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isMember = space.isMember !== false;
  const canLeave = isMember && space.role !== 'OWNER' && space.type !== 'PERSONAL';

  const cardContent = (
    <Card className={`transition-colors h-full ${isMember ? 'hover:border-primary/50 cursor-pointer' : 'opacity-75 border-dashed'}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className={`w-5 h-5 ${isMember ? 'text-primary' : 'text-muted-foreground'}`} />
            <CardTitle className="text-lg">{space.name}</CardTitle>
          </div>
          {isMember ? (
            <Badge variant={space.type === 'PERSONAL' ? 'secondary' : 'outline'}>
              {space.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Non rejoint</Badge>
          )}
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
        {(canLeave || canDelete) && (
          <div className="mt-2 flex items-center gap-3">
            {canLeave && onLeave && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLeaveModal(true);
                }}
              >
                <LogOut className="w-3 h-3" />
                Quitter
              </button>
            )}
            {canDelete && onDelete && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteModal(true);
                }}
              >
                <Trash2 className="w-3 h-3" />
                Supprimer
              </button>
            )}
          </div>
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
    <ConfirmModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={() => {
        onDelete(space.id, space.name);
        setShowDeleteModal(false);
      }}
      title="Supprimer l'espace"
      message={`Vous êtes sur le point de supprimer l'espace « ${space.name} ».`}
      warning="Cette action est irréversible. Tous les éléments, relations et contributions seront définitivement perdus."
      confirmLabel="Supprimer"
    />
  );

  if (isMember) {
    return <>{leaveModal}{deleteModal}<Link to={`/spaces/${space.id}`}>{cardContent}</Link></>;
  }

  return <>{leaveModal}{deleteModal}{cardContent}</>;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewSpace = searchParams.get('new') === 'space';
  const { currentCommunity } = useCommunityStore();
  const [activeTab, setActiveTab] = useState<'spaces' | 'graph' | 'sunburst'>('spaces');

  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<'PERSONAL' | 'GROUP'>('GROUP');
  const [newSpaceCommunityId, setNewSpaceCommunityId] = useState<string>(currentCommunity?.id || '');
  const [newSpaceParentId, setNewSpaceParentId] = useState<string>('');

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
    },
  });

  const handleLeaveSpace = (spaceId: string) => {
    leaveSpaceMutation.mutate(spaceId);
  };

  // Delete space mutation
  const deleteSpaceMutation = useMutation({
    mutationFn: spacesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  const handleDeleteSpace = (spaceId: string) => {
    deleteSpaceMutation.mutate(spaceId);
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
      });
    }
  };

  const closeNewSpaceForm = () => {
    setSearchParams({});
    setNewSpaceName('');
    setNewSpaceCommunityId('');
    setNewSpaceParentId('');
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
    <div className={`flex flex-col${activeTab === 'graph' || activeTab === 'sunburst' ? ' h-full overflow-hidden' : ''}`}>
      {/* Barre d'actions sticky */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-8 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab('spaces')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'spaces'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              Espaces
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'graph'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="w-4 h-4" />
              Graphe global
            </button>
            <button
              onClick={() => setActiveTab('sunburst')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sunburst'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CircleDot className="w-4 h-4" />
              Sunburst
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="w-4 h-4" />
              Mes tâches
            </button>
          </div>
          {activeTab === 'spaces' && (
            <Button onClick={() => setSearchParams({ new: 'space' })}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel espace
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'graph' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <GraphView
            level="global"
            onNodeClick={(itemId, spaceId) => navigate(`/spaces/${spaceId}`, { state: { openItemId: itemId } })}
          />
        </div>
      ) : activeTab === 'sunburst' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <SunburstView />
        </div>
      ) : (
      <div className="p-8 flex-1">
      <div className="max-w-6xl mx-auto">

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
                  />
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
              return (
                <section key={group.communityId}>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{group.communityName}</h2>
                    <Badge variant="outline" className="ml-1">{group.spaces.length}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tree.map((node) => (
                      <div key={node.id}>
                        <SpaceCardWithChildren node={node} onJoin={handleJoinSpace} onLeave={handleLeaveSpace} onDelete={handleDeleteSpace} communityRoles={communityRoles} />
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
                        <SpaceCardWithChildren node={node} onDelete={handleDeleteSpace} />
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
    </div>
  );
}

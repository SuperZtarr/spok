import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Users, FileText, Plus, X, Building2, User, LogIn } from 'lucide-react';
import { spacesApi, communitiesApi } from '../lib/api';
import { useCommunityStore } from '../stores/community';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { SpaceWithRole } from '@spok/shared';

// Reusable space card component
function SpaceCard({ space, onJoin }: { space: SpaceWithRole; onJoin?: (id: string) => void }) {
  const isMember = space.isMember !== false;

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
      </CardContent>
    </Card>
  );

  if (isMember) {
    return <Link to={`/spaces/${space.id}`}>{cardContent}</Link>;
  }

  return cardContent;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewSpace = searchParams.get('new') === 'space';
  const { currentCommunity } = useCommunityStore();

  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<'PERSONAL' | 'GROUP'>('GROUP');
  const [newSpaceCommunityId, setNewSpaceCommunityId] = useState<string>('');

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

  // Fetch communities for the select dropdown
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

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
      });
    }
  };

  const closeNewSpaceForm = () => {
    setSearchParams({});
    setNewSpaceName('');
    setNewSpaceCommunityId('');
  };

  // When space type changes, reset community if personal
  const handleTypeChange = (type: 'PERSONAL' | 'GROUP') => {
    setNewSpaceType(type);
    if (type === 'PERSONAL') {
      setNewSpaceCommunityId('');
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

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos espaces et projets
            </p>
          </div>
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
                <Button variant="ghost" size="icon" onClick={closeNewSpaceForm}>
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
                    <SpaceCard key={space.id} space={space} />
                  ))}
                </div>
              </section>
            )}

            {/* Community groups */}
            {communityGroups.map((group) => (
              <section key={group.communityId}>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{group.communityName}</h2>
                  <Badge variant="outline" className="ml-1">{group.spaces.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.spaces.map((space) => (
                    <SpaceCard key={space.id} space={space} onJoin={handleJoinSpace} />
                  ))}
                </div>
              </section>
            ))}

            {/* Independent group spaces (no community) */}
            {independentSpaces.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Espaces de groupe</h2>
                  <Badge variant="outline" className="ml-1">{independentSpaces.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {independentSpaces.map((space) => (
                    <SpaceCard key={space.id} space={space} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Users, FileText, Plus, X, Building2 } from 'lucide-react';
import { spacesApi, communitiesApi } from '../lib/api';
import { useCommunityStore } from '../stores/community';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewSpace = searchParams.get('new') === 'space';
  const { currentCommunity } = useCommunityStore();

  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceType, setNewSpaceType] = useState<'PERSONAL' | 'GROUP'>('GROUP');
  const [newSpaceCommunityId, setNewSpaceCommunityId] = useState<string>('');

  const { data: spaces, isLoading } = useQuery({
    queryKey: ['spaces', currentCommunity?.id],
    queryFn: () => spacesApi.list(currentCommunity?.id || 'none'),
  });

  // Fetch personal spaces separately when community is selected
  const { data: personalSpaces } = useQuery({
    queryKey: ['spaces', 'personal'],
    queryFn: () => spacesApi.list('none'),
    enabled: !!currentCommunity,
  });

  // Combine spaces
  const displaySpaces = currentCommunity
    ? [...(personalSpaces?.filter(s => s.type === 'PERSONAL') || []), ...(spaces || [])]
    : spaces;

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

        {/* Spaces grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Chargement...
          </div>
        ) : displaySpaces?.length === 0 ? (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displaySpaces?.map((space) => (
              <Link key={space.id} to={`/spaces/${space.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{space.name}</CardTitle>
                      </div>
                      <Badge variant={space.type === 'PERSONAL' ? 'secondary' : 'outline'}>
                        {space.type === 'PERSONAL' ? 'Personnel' : 'Groupe'}
                      </Badge>
                    </div>
                    <CardDescription>
                      Rôle: {space.role === 'OWNER' ? 'Propriétaire' : space.role}
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
                      {space.communityId && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

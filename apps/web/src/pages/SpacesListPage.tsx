import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { FolderOpen, Loader2 } from 'lucide-react';
import { spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { SpaceCard } from '../components/ui/SpaceCard';
import type { SpaceWithRole } from '@spok/shared';

export function SpacesListPage() {
  const user = useAuthStore(s => s.user);
  const { currentCommunity } = useCommunityStore();

  // Sans communauté sélectionnée, rediriger vers la liste des communautés
  if (!currentCommunity) {
    return <Navigate to="/communities" replace />;
  }

  const { data: allSpaces, isLoading } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
    enabled: !!user,
  });

  const spaces = useMemo(() => {
    if (!allSpaces) return [];
    // Sans communauté : uniquement les espaces indépendants (hors communauté, hors perso)
    // Avec communauté : uniquement les espaces de cette communauté
    if (currentCommunity) {
      return allSpaces.filter((s: SpaceWithRole) => s.communityId === currentCommunity.id);
    }
    return allSpaces.filter((s: SpaceWithRole) => s.type !== 'PERSONAL' && !s.communityId);
  }, [allSpaces, currentCommunity]);

  const personalSpaces = useMemo(() => {
    if (!allSpaces || currentCommunity) return [];
    return allSpaces.filter((s: SpaceWithRole) => s.type === 'PERSONAL');
  }, [allSpaces, currentCommunity]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title = currentCommunity ? `Espaces — ${currentCommunity.name}` : 'Tous les espaces';
  const total = spaces.length + personalSpaces.length;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} espace{total !== 1 ? 's' : ''}
          </p>
        </div>

        {total === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucun espace</p>
            <p className="text-sm text-muted-foreground">
              {currentCommunity ? 'Cette communaute ne contient aucun espace.' : 'Vous n\'avez acces a aucun espace.'}
            </p>
          </div>
        ) : (
          <>
            {spaces.length > 0 && (
              <div className="mb-8">
                {!currentCommunity && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Espaces de groupe</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {spaces.map(space => (
                    <SpaceCard key={space.id} space={space} />
                  ))}
                </div>
              </div>
            )}

            {personalSpaces.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Espaces personnels</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {personalSpaces.map(space => (
                    <SpaceCard key={space.id} space={space} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

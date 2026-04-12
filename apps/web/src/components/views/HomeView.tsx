import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FolderKanban, FolderOpen, Rocket, LogIn, Plus, ArrowRight, LayoutDashboard, Search, Mail, Star } from 'lucide-react';
import { communitiesApi, spacesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { SpaceCard } from '../ui/SpaceCard';
import { getRecentSpaceIds } from '../../hooks/useRecentSpaces';

function FirstTimeSetup({ userName }: { userName: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: publicCommunities } = useQuery({
    queryKey: ['communities-public'],
    queryFn: communitiesApi.listPublic,
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => communitiesApi.join(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  return (
    <div className="p-8 flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">Bienvenue {userName} !</h1>
          <p className="text-muted-foreground mt-2">
            C'est votre premier pas sur SPOK. Commencez par rejoindre une communauté ou créez la vôtre.
          </p>
        </div>

        {publicCommunities && publicCommunities.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Rejoignez une communauté
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ces communautés publiques sont ouvertes à tous.
            </p>
            <div className="space-y-2">
              {publicCommunities.map(c => (
                <div key={c.id} className="flex items-center gap-3 border border-border rounded-lg p-3 hover:bg-accent/30 transition-colors">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{c.memberCount} membre{c.memberCount > 1 ? 's' : ''} · {c.spaceCount} espace{c.spaceCount > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => joinMutation.mutate(c.id)}
                    disabled={joinMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
                  >
                    <LogIn className="w-4 h-4" />
                    Rejoindre
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {publicCommunities && publicCommunities.length > 0 ? '2' : '1'}
            </span>
            Créez votre communauté
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Une communauté regroupe des personnes autour d'un sujet commun. Vous en serez le propriétaire.
          </p>
          <button
            onClick={() => navigate('/communities')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer une communauté
            <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </button>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {publicCommunities && publicCommunities.length > 0 ? '3' : '2'}
            </span>
            Ou commencez avec un espace personnel
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Un espace personnel est privé et visible uniquement par vous. Idéal pour tester SPOK.
          </p>
          <button
            onClick={() => navigate('/spaces?new=space')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <FolderKanban className="w-4 h-4" />
            Créer un espace personnel
            <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </button>
        </section>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  { to: '/communities', icon: Users, label: 'Communautés', description: 'Voir toutes mes communautés et leurs espaces' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', description: 'Suivi des tâches et échéances' },
  { to: '/search', icon: Search, label: 'Recherche', description: 'Rechercher dans tous les contenus' },
];

export function HomeView() {
  const user = useAuthStore(s => s.user);

  const { data: communities, isLoading: loadingCommunities } = useQuery({
    queryKey: ['communities', user?.id || 'public'],
    queryFn: communitiesApi.list,
  });

  const { data: allSpaces, isLoading: loadingSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
    enabled: !!user,
  });

  const { data: favoriteIds } = useQuery({
    queryKey: ['spaces', 'favorites'],
    queryFn: () => spacesApi.getFavorites(),
    enabled: !!user,
  });

  const favoriteSpaces = (favoriteIds || [])
    .map(id => (allSpaces || []).find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const isLoading = loadingCommunities || loadingSpaces;
  const firstName = user?.name?.split(' ')[0] || '';

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  }

  const totalSpaces = allSpaces?.length || 0;
  const totalCommunities = (communities || []).filter(c => c.role && c.role !== 'INVITED' && c.role !== 'ADMIN_VIEW').length;

  if (totalCommunities === 0 && totalSpaces === 0 && !isLoading) {
    return <FirstTimeSetup userName={firstName} />;
  }

  return (
    <div className="p-4 md:p-6 flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto">
        {/* Welcome */}
        <div className="mb-8 text-center" data-tour="home-welcome">
          <img src="/logo.png" alt="SPOK" className="h-28 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Bonjour {firstName}</h1>
          <p className="text-muted-foreground mt-1">
            {totalCommunities} communauté{totalCommunities > 1 ? 's' : ''}
            {' · '}
            {totalSpaces} espace{totalSpaces > 1 ? 's' : ''}
          </p>
        </div>

        {/* Pending invitations */}
        {(() => {
          const invited = (communities || []).filter(c => c.role === 'INVITED');
          if (invited.length === 0) return null;
          return (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-orange-500" />
                Invitations en attente
                <span className="text-xs font-normal">({invited.length})</span>
              </h2>
              <div className="space-y-2">
                {invited.map(c => (
                  <Link
                    key={c.id}
                    to={`/communities/${c.id}`}
                    className="flex items-center gap-3 border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg p-3 hover:bg-orange-100/50 dark:hover:bg-orange-950/30 transition-colors"
                  >
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-orange-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                    </div>
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1 flex-shrink-0">
                      Voir <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Shortcuts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {SHORTCUTS.map(({ to, icon: Icon, label, description }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 p-4 border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all bg-card text-center"
            >
              <Icon className="w-6 h-6 text-primary" />
              <span className="font-medium text-sm">{label}</span>
              <span className="text-[11px] text-muted-foreground leading-tight">{description}</span>
            </Link>
          ))}
        </div>

        {/* Favorite spaces */}
        {favoriteSpaces.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Espaces favoris
              <span className="text-xs font-normal">({favoriteSpaces.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favoriteSpaces.map(space => (
                <SpaceCard key={space.id} space={space} />
              ))}
            </div>
          </section>
        )}

        {/* Recent spaces — quick access to last visited */}
        {allSpaces && allSpaces.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Espaces récents
              </h2>
              <Link to="/spaces" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {(() => {
                const recentIds = getRecentSpaceIds();
                const spaceMap = new Map(allSpaces.map(s => [s.id, s]));
                const recent = recentIds.map(id => spaceMap.get(id)).filter(Boolean) as typeof allSpaces;
                const displayed = recent.length > 0 ? recent.slice(0, 8) : allSpaces.slice(0, 8);
                return displayed.map(space => <SpaceCard key={space.id} space={space} />);
              })()}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

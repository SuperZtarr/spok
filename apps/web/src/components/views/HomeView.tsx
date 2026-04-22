import { useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.png';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FolderKanban, FolderOpen, Rocket, LogIn, Plus, ArrowRight, LayoutDashboard, Search, Mail, Star, Clock, Pencil } from 'lucide-react';
import { communitiesApi, spacesApi, userTasksApi, type GlobalTask } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { SpaceCard } from '../ui/SpaceCard';
import { getRecentSpaceIds } from '../../hooks/useRecentSpaces';

const HOME_VISIT_KEY = 'spok-home-last-visit';
const ALL_TYPES = 'NOTE,PROJECT,TASK,MEETING,PERIOD,LINK,CONFIG,DOCUMENT,IMAGE,BUG,DIAGRAM';

const TYPE_COLORS: Record<string, string> = {
  TASK: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  NOTE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PROJECT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  MEETING: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DOCUMENT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  PERIOD: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  LINK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  IMAGE: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
};
const TYPE_LABELS: Record<string, string> = {
  TASK: 'Tâche', NOTE: 'Note', PROJECT: 'Projet', MEETING: 'Réunion',
  BUG: 'Bug', DOCUMENT: 'Doc', PERIOD: 'Période', LINK: 'Lien', IMAGE: 'Image', DIAGRAM: 'Diag',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (min < 2) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  if (h < 24) return `il y a ${h}h`;
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function RecentItemRow({ item, onClick }: { item: GlobalTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors text-left group"
    >
      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[item.type] || 'bg-muted text-muted-foreground'}`}>
        {TYPE_LABELS[item.type] || item.type}
      </span>
      <span className="flex-1 text-sm truncate">{item.title}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">{item.spaceName}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(item.updatedAt)}</span>
    </button>
  );
}

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
  const navigate = useNavigate();

  // Capture last home visit for new/modified split
  const lastVisitRef = useRef<Date | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(HOME_VISIT_KEY);
    lastVisitRef.current = stored ? new Date(stored) : null;
    localStorage.setItem(HOME_VISIT_KEY, new Date().toISOString());
  }, []);

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

  const { data: recentData } = useQuery({
    queryKey: ['home-recent-items'],
    queryFn: () => userTasksApi.list({ type: ALL_TYPES, sortBy: 'updatedAt', sortDir: 'desc', pageSize: 20 }),
    enabled: !!user,
  });

  const { newItems, modifiedItems, lastVisit } = useMemo(() => {
    const items = recentData?.data || [];
    const lastVisit = lastVisitRef.current;
    if (!lastVisit) return { newItems: [], modifiedItems: items.slice(0, 20), lastVisit: null };
    const newItems: GlobalTask[] = [];
    const modifiedItems: GlobalTask[] = [];
    for (const item of items) {
      if (new Date(item.createdAt) > lastVisit) newItems.push(item);
      else if (new Date(item.updatedAt) > lastVisit) modifiedItems.push(item);
    }
    return { newItems, modifiedItems, lastVisit };
  }, [recentData]);

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
      <div className="max-w-6xl mx-auto">
        {/* Welcome */}
        <div className="mb-8 text-center" data-tour="home-welcome">
          <img src={logoUrl} alt="SPOK" className="h-80 w-auto mx-auto mb-4" />
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

        {/* Recent modifications */}
        {(newItems.length > 0 || modifiedItems.length > 0) && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Modifications récentes
              </h2>
              {lastVisit && (
                <span className="text-xs text-muted-foreground/60 font-normal">
                  — depuis {formatRelativeTime(lastVisit.toISOString())}
                </span>
              )}
            </div>
            <div className="border border-border rounded-xl bg-card divide-y divide-border overflow-hidden">
              {newItems.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 mb-1">
                    <Plus className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">Nouveaux ({newItems.length})</span>
                  </div>
                  {newItems.map(item => (
                    <RecentItemRow key={item.id} item={item} onClick={() => navigate(`/spaces/${item.spaceId}/content`)} />
                  ))}
                </div>
              )}
              {modifiedItems.length > 0 && (
                <div className="p-2">
                  {lastVisit && (
                    <div className="flex items-center gap-1.5 px-3 py-1 mb-1">
                      <Pencil className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Modifiés ({modifiedItems.length})</span>
                    </div>
                  )}
                  {modifiedItems.map(item => (
                    <RecentItemRow key={item.id} item={item} onClick={() => navigate(`/spaces/${item.spaceId}/content`)} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

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

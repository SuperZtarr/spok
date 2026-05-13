import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.png';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FolderKanban, Rocket, LogIn, Plus, ArrowRight, LayoutDashboard, Search, Mail, Star, Clock, Activity, AlertTriangle, CalendarDays, Bell } from 'lucide-react';
import { communitiesApi, spacesApi, activityApi, userTasksApi, notificationsApi } from '../../lib/api';
import type { GlobalTask } from '../../lib/api';
import type { Notification } from '@spok/shared';
import { TYPE_LABELS } from '../../constants/ui';
import { TYPE_ICONS } from '../../constants/ui';
import { useAuthStore } from '../../stores/auth';
import { SpaceCard } from '../ui/SpaceCard';

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

const DONE_STATUSES = ['done', 'cancelled'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------------------------------------------------------------------------
// Compact preview card for dashboard sections
// ---------------------------------------------------------------------------

function DashboardPreviewCard({
  title,
  icon,
  count,
  items,
  to,
  variant = 'default',
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  items: { id: string }[];
  to: string;
  variant?: 'default' | 'danger';
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${variant === 'danger' ? 'border-red-200 dark:border-red-900/50' : 'border-border'}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${variant === 'danger' ? 'border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20' : 'border-border'}`}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span className={`text-xs font-semibold ${variant === 'danger' ? 'text-red-700 dark:text-red-400' : ''}`}>{title}</span>
          {count > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${variant === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}>
              {count}
            </span>
          )}
        </div>
        <Link to={to} className="text-[10px] text-primary hover:underline flex items-center gap-0.5 flex-shrink-0">
          Voir tout <ArrowRight className="w-2.5 h-2.5" />
        </Link>
      </div>
      {count === 0
        ? <p className="text-[11px] text-muted-foreground text-center py-4">—</p>
        : <div className="divide-y divide-border">{items.slice(0, 5).map(item => renderItem(item))}</div>
      }
    </div>
  );
}

function TaskPreviewRow({ task }: { task: GlobalTask }) {
  const Icon = TYPE_ICONS[task.type as keyof typeof TYPE_ICONS] || TYPE_ICONS.NOTE;
  const isOverdue = !!(task.dueDate && new Date(task.dueDate) < startOfDay(new Date()) && !DONE_STATUSES.includes(task.status || ''));
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate text-xs">{task.title}</span>
      {task.dueDate && (
        <span className={`text-[10px] flex-shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

function NotifPreviewRow({ notif }: { notif: Notification }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Bell className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate text-xs">{notif.title}</span>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">
        {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </span>
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

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.feed(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: myTasksData } = useQuery({
    queryKey: ['home-my-tasks'],
    queryFn: () => userTasksApi.list({ status: 'none,todo,in_progress,to_validate,late', myTasks: true, pageSize: 200 }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['home-notifications'],
    queryFn: () => notificationsApi.list(20, 0),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Badges branchés sur le feed d'activité (items modifiés par d'autres, non vus)
  const { activityBySpace, activityByCommunity } = useMemo(() => {
    const bySpace = new Map<string, number>();
    const byComm = new Map<string, number>();
    for (const group of (activityData?.groups ?? [])) {
      for (const spaceGroup of group.spaces) {
        bySpace.set(spaceGroup.space.id, spaceGroup.items.length);
        byComm.set(group.community.id, (byComm.get(group.community.id) || 0) + spaceGroup.items.length);
      }
    }
    return { activityBySpace: bySpace, activityByCommunity: byComm };
  }, [activityData]);

  const favoriteSpaces = (favoriteIds || [])
    .map(id => (allSpaces || []).find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const allMyTasks = myTasksData?.data || [];
  const today = startOfDay(new Date());
  const in7Days = new Date(today); in7Days.setDate(in7Days.getDate() + 7);

  const upcomingTasks = useMemo(() =>
    allMyTasks.filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= in7Days)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [allMyTasks]
  );

  const overdueTasks = useMemo(() =>
    allMyTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && !DONE_STATUSES.includes(t.status || ''))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [allMyTasks]
  );

  const todoTasks = useMemo(() =>
    allMyTasks.filter(t => t.status === 'todo'),
    [allMyTasks]
  );

  const unreadNotifs = useMemo(() =>
    (notifData || []).filter(n => !n.read),
    [notifData]
  );

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
      <div className="max-w-screen-2xl mx-auto">
        {/* Welcome */}
        <div className="mb-8 text-center" data-tour="home-welcome">
          <img src={logoUrl} alt="SPOK" className="h-24 sm:h-48 md:h-80 w-auto mx-auto mb-4" />
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
        <div className="grid grid-cols-3 gap-3 mb-8">
          {SHORTCUTS.map(({ to, icon: Icon, label, description }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 p-3 md:p-4 border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all bg-card text-center"
            >
              <Icon className="w-6 h-6 text-primary" />
              <span className="font-medium text-sm">{label}</span>
              <span className="text-[11px] text-muted-foreground leading-tight hidden sm:block">{description}</span>
            </Link>
          ))}
        </div>

        {/* Dashboard preview sections */}
        {!!user && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            <DashboardPreviewCard
              title="Échéances proches"
              icon={<CalendarDays className="w-3.5 h-3.5 text-orange-500" />}
              count={upcomingTasks.length}
              items={upcomingTasks}
              to="/dashboard"
              renderItem={(task: GlobalTask) => <TaskPreviewRow key={task.id} task={task} />}
            />
            <DashboardPreviewCard
              title="En retard"
              icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              count={overdueTasks.length}
              items={overdueTasks}
              to="/dashboard"
              variant="danger"
              renderItem={(task: GlobalTask) => <TaskPreviewRow key={task.id} task={task} />}
            />
            <DashboardPreviewCard
              title="TODO assignés"
              icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
              count={todoTasks.length}
              items={todoTasks}
              to="/dashboard"
              renderItem={(task: GlobalTask) => <TaskPreviewRow key={task.id} task={task} />}
            />
            <DashboardPreviewCard
              title="Non lus"
              icon={<Bell className="w-3.5 h-3.5 text-violet-500" />}
              count={unreadNotifs.length}
              items={unreadNotifs}
              to="/notifications"
              renderItem={(notif: Notification) => <NotifPreviewRow key={notif.id} notif={notif} />}
            />
          </div>
        )}

        {/* Activity summary */}
        {(() => {
          const total = activityData?.total ?? 0;
          if (total === 0) return null;
          const previewItems = (activityData?.groups ?? []).flatMap((g: any) =>
            g.spaces.flatMap((s: any) =>
              s.items.map((item: any) => ({ ...item, spaceName: s.space.name, communityName: g.community.name }))
            )
          ).slice(0, 5);
          return (
            <section className="mb-8">
              <div className="bg-card border border-border rounded-xl overflow-hidden w-fit max-w-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold">Activité récente</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                      {total > 99 ? '99+' : total}
                    </span>
                  </div>
                  <Link to="/activity" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    Voir tout <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
                  {previewItems.map((item: any) => {
                    const diff = Date.now() - new Date(item.activityAt).getTime();
                    const minutes = Math.floor(diff / 60000);
                    const timeLabel = minutes < 1 ? 'à l\'instant' : minutes < 60 ? `${minutes}min` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}j`;
                    return (
                      <Link
                        key={item.id}
                        to="/activity"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors flex-shrink-0 max-w-[200px]"
                      >
                        <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wide leading-none flex-shrink-0">
                          {TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] ?? item.type}
                        </span>
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Communities with recent activity */}
        {(communities || []).filter(c => c.role && c.role !== 'INVITED' && c.role !== 'ADMIN_VIEW').length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" />
                Communautés
              </h2>
              <Link to="/communities" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(communities || [])
                .filter(c => c.role && c.role !== 'INVITED' && c.role !== 'ADMIN_VIEW')
                .map(c => {
                  const count = activityByCommunity.get(c.id) || 0;
                  return (
                    <Link
                      key={c.id}
                      to={`/communities/${c.id}`}
                      className="flex flex-col border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all bg-card"
                    >
                      {/* Bandeau */}
                      {c.coverUrl ? (
                        <img src={c.coverUrl} alt="" className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 bg-primary/10 flex items-center justify-center">
                          <Users className="w-7 h-7 text-primary/40" />
                        </div>
                      )}
                      {/* Infos */}
                      <div className="flex items-center gap-2 p-3">
                        {c.avatarUrl && (
                          <img src={c.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 -mt-5 ring-2 ring-card" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.memberCount ?? 0} membre{(c.memberCount ?? 0) > 1 ? 's' : ''} · {c.spaceCount ?? 0} espace{(c.spaceCount ?? 0) > 1 ? 's' : ''}
                          </p>
                        </div>
                        {count > 0 && (
                          <span className="animate-pulse shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-500 text-white shadow-sm">
                            <Clock className="w-3 h-3" />
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
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
                <SpaceCard key={space.id} space={space} activityCount={activityBySpace.get(space.id)} to={`/spaces/${space.id}`} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

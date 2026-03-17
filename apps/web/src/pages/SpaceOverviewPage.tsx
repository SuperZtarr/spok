import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FolderOpen, Settings, Crown, User, ChevronRight, ExternalLink, List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar, LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, TrendingDown, Layers, Table2, Grid3x3, Focus, Flame } from 'lucide-react';
import { spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { RoleGuard } from '../components/RoleGuard';
import { useViewModeStore, type ViewMode } from '../stores/viewMode';
import { useViewConfig } from '../hooks/useViewConfig';

const VIEW_ICONS: Record<string, typeof List> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar, LayoutGrid,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc,
  TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
};

const VIEW_DESCRIPTIONS: Partial<Record<ViewMode, string>> = {
  list: 'Tableau avec colonnes triables',
  tree: 'Hiérarchie parent-enfant',
  kanban: 'Colonnes par statut',
  text: 'Document texte continu',
  planning: 'Planning avec jalons',
  timeline: 'Diagramme de Gantt',
  calendar: 'Vue calendrier mensuelle',
  types: 'Groupé par type d\'item',
  mindmap: 'Carte mentale interactive',
  graph: 'Réseau de relations',
  sunburst: 'Cercles concentriques',
  relations: 'Carte des relations',
  bubble: 'Bulles proportionnelles',
  radialTree: 'Arbre en cercle',
  treemap: 'Rectangles proportionnels',
  chord: 'Diagramme de flux',
  burndown: 'Courbe d\'avancement',
  cfd: 'Flux cumulatif',
  members: 'Kanban par membre',
  priority: 'Kanban par priorité',
  crossTable: 'Tableau croisé dynamique',
  heatmap: 'Activité temporelle',
  ego: 'Réseau égocentrique',
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

function ChildSpaceNode({ node, level }: { node: any; level: number }) {
  return (
    <>
      <Link
        to={`/spaces/${node.id}`}
        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
        style={{ marginLeft: `${level * 24}px` }}
      >
        {level > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <p className="text-xs text-muted-foreground">{node.itemCount || 0} élément{(node.itemCount || 0) > 1 ? 's' : ''}</p>
        </div>
      </Link>
      {node.children?.map((child: any) => (
        <ChildSpaceNode key={child.id} node={child} level={level + 1} />
      ))}
    </>
  );
}

export function SpaceOverviewPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { views: configViews, categories: configCategories } = useViewConfig();

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const { data: members } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId!),
    enabled: !!spaceId,
  });

  // Fetch sibling spaces from same community to find children
  const { data: communitySpaces } = useQuery({
    queryKey: ['spaces', space?.communityId],
    queryFn: () => spacesApi.list(space!.communityId!),
    enabled: !!space?.communityId,
  });

  const childSpaces = useMemo(() => {
    if (!communitySpaces || !spaceId) return [];
    return communitySpaces.filter(s => s.parentId === spaceId);
  }, [communitySpaces, spaceId]);

  const isAdminOrOwner = space?.role === 'OWNER';

  const roleOrder: Record<string, number> = { OWNER: 0, MEMBER: 1 };
  const sortedMembers = [...(members || [])].sort((a, b) =>
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  // Build child space tree from all community spaces
  const spaceTree = useMemo(() => {
    if (!communitySpaces || !spaceId) return [];
    // Get all descendants of this space
    const descendants = new Set<string>();
    const findDescendants = (parentId: string) => {
      communitySpaces.forEach(s => {
        if (s.parentId === parentId && !descendants.has(s.id)) {
          descendants.add(s.id);
          findDescendants(s.id);
        }
      });
    };
    findDescendants(spaceId);

    const relevant = communitySpaces.filter(s => descendants.has(s.id));
    type SpaceNode = (typeof relevant)[number] & { children: SpaceNode[] };
    const map = new Map<string, SpaceNode>();
    const roots: SpaceNode[] = [];
    relevant.forEach(s => map.set(s.id, { ...s, children: [] }));
    relevant.forEach(s => {
      if (s.parentId && s.parentId !== spaceId && map.has(s.parentId)) {
        map.get(s.parentId)!.children.push(map.get(s.id)!);
      } else {
        roots.push(map.get(s.id)!);
      }
    });
    return roots;
  }, [communitySpaces, spaceId]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header with cover */}
      <div className="relative">
        {space?.coverUrl ? (
          <div className="h-32 sm:h-48 bg-cover bg-center" style={{ backgroundImage: `url(${space.coverUrl})` }} />
        ) : (
          <div className="h-32 sm:h-48 bg-gradient-to-r from-primary/20 to-primary/5" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent h-16" />
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        {/* Space info */}
        <div className="flex items-end gap-4 mb-6">
          {space?.avatarUrl ? (
            <img src={space.avatarUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" />
          ) : (
            <div className="w-16 h-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
              <FolderOpen className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{space?.name}</h1>
            </div>
            {space?.community && (
              <Link to={`/communities/${space.community.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {space.community.name}
              </Link>
            )}
            {space?.parent && (
              <span className="text-sm text-muted-foreground ml-2">
                &middot; <Link to={`/spaces/${space.parent.id}`} className="hover:text-primary transition-colors">{space.parent.name}</Link>
              </span>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            <Button variant="default" size="sm" onClick={() => navigate(`/spaces/${spaceId}/content`)}>
              <ExternalLink className="w-4 h-4 mr-1.5" />Ouvrir
            </Button>
            {isAdminOrOwner && (
              <RoleGuard role="OWNER">
                <Button variant="outline" size="sm" onClick={() => navigate(`/spaces/${spaceId}/settings`)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </RoleGuard>
            )}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <div className="p-4 rounded-lg border border-border">
            <p className="text-2xl font-bold">{space?.itemCount || 0}</p>
            <p className="text-xs text-muted-foreground">Éléments</p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <p className="text-2xl font-bold">{members?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Membres</p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <p className="text-2xl font-bold">{childSpaces?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Sous-espaces</p>
          </div>
        </div>

        {/* Views grid */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Vues disponibles
          </h2>
          {configCategories.map(cat => {
            const views = configViews.filter(v => v.category === cat.id);
            if (views.length === 0) return null;
            return (
              <div key={cat.id} className="mb-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2">{cat.label}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {views.map(view => {
                    const Icon = VIEW_ICONS[view.icon] || List;
                    return (
                      <button
                        key={view.id}
                        onClick={() => {
                          useViewModeStore.getState().setMode(view.id as ViewMode);
                          navigate(`/spaces/${spaceId}/content`);
                        }}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/30 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{view.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{VIEW_DESCRIPTIONS[view.id as ViewMode] || ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Child spaces section */}
        {spaceTree.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Sous-espaces ({childSpaces?.length || 0})
            </h2>
            <div className="space-y-1">
              {spaceTree.map(node => (
                <ChildSpaceNode key={node.id} node={node} level={0} />
              ))}
            </div>
          </div>
        )}

        {/* Members section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Membres ({sortedMembers.length})
          </h2>
          {sortedMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedMembers.map(member => {
                const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.MEMBER;
                const RoleIcon = config.icon;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.name}
                        {member.userId === user?.id && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}
                      </p>
                      <div className="flex items-center gap-1">
                        <RoleIcon className={`w-3 h-3 ${config.color}`} />
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun membre direct dans cet espace.</p>
          )}
        </div>
      </div>
    </div>
  );
}

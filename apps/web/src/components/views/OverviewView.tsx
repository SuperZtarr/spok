import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FolderOpen, Settings, Crown, User, List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar, LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, TrendingDown, Layers, Table2, Grid3x3, Focus, Flame, ExternalLink, Image, Bug } from 'lucide-react';
import { spacesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../ui/Button';
import { RoleGuard } from '../RoleGuard';
import { useViewModeStore, type ViewMode } from '../../stores/viewMode';
import { useMenuItems } from '../../hooks/useMenuItems';
import type { SpaceWithRole } from '@spok/shared';

const VIEW_ICONS: Record<string, typeof List> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar, LayoutGrid,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc,
  TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus, ExternalLink, Image, Bug,
};

const VIEW_DESCRIPTIONS: Partial<Record<ViewMode, string>> = {
  list: 'Tableau avec colonnes triables',
  tree: 'Hierarchie parent-enfant',
  kanban: 'Colonnes par statut',
  text: 'Document texte continu',
  planning: 'Planning avec jalons',
  timeline: 'Diagramme de Gantt',
  calendar: 'Vue calendrier mensuelle',
  types: 'Groupe par type d\'item',
  mindmap: 'Carte mentale interactive',
  graph: 'Reseau de relations',
  sunburst: 'Cercles concentriques',
  relations: 'Carte des relations',
  bubble: 'Bulles proportionnelles',
  radialTree: 'Arbre en cercle',
  treemap: 'Rectangles proportionnels',
  chord: 'Diagramme de flux',
  burndown: 'Courbe d\'avancement',
  cfd: 'Flux cumulatif',
  members: 'Kanban par membre',
  priority: 'Kanban par priorite',
  crossTable: 'Tableau croise dynamique',
  heatmap: 'Activite temporelle',
  ego: 'Reseau egocentrique',
  links: 'Liens avec favicon',
  images: 'Galerie d\'images',
  documents: 'Fichiers et documents',
  bugs: 'Liste des bugs',
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Proprietaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

interface OverviewViewProps {
  spaceId: string;
  space: SpaceWithRole | undefined;
}

export function OverviewView({ spaceId, space }: OverviewViewProps) {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { spaceViewSections } = useMenuItems();
  const { setMode } = useViewModeStore();

  const { data: members } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
    enabled: !!spaceId && !!user,
  });

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

  const spaceTree = useMemo(() => {
    if (!communitySpaces || !spaceId) return [];
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-4">
        {/* Cover */}
        <div className="relative">
          {space?.coverUrl ? (
            <div className="aspect-[5/1] rounded-xl overflow-hidden">
              <img src={space.coverUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `center ${(space as any).coverPosition ?? 50}%`, transform: `scale(${((space as any).coverZoom ?? 100) / 100})`, transformOrigin: `center ${(space as any).coverPosition ?? 50}%` }} />
            </div>
          ) : (
            <div className="aspect-[5/1] bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl" />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent h-16 rounded-b-xl" />
        </div>

        {/* Space info */}
        <div className="-mt-8 relative z-10">
          <div className="flex items-end gap-4 mb-6">
            {space?.avatarUrl ? (
              <img src={space.avatarUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" />
            ) : space?.coverUrl ? (
              <img src={space.coverUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
            ) : (
              <div className="w-16 h-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
                <FolderOpen className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold truncate">{space?.name}</h1>
              {space?.community && (
                <Link to={`/communities/${space.community.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {space.community.name}
                </Link>
              )}
              {(space as any)?.parent && (
                <span className="text-sm text-muted-foreground ml-2">
                  &middot; <Link to={`/spaces/${(space as any).parent.id}`} className="hover:text-primary transition-colors">{(space as any).parent.name}</Link>
                </span>
              )}
            </div>
            <div className="flex gap-2 pb-1">
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
              <p className="text-2xl font-bold">{(space as any)?.itemCount || 0}</p>
              <p className="text-xs text-muted-foreground">Elements</p>
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
            {spaceViewSections.map(section => {
              const views = section.items;
              if (views.length === 0) return null;
              return (
                <div key={section.id} className="mb-4">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">{section.label}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {views.map(view => {
                      const Icon = VIEW_ICONS[view.icon] || List;
                      return (
                        <button
                          key={view.key}
                          onClick={() => setMode(view.viewMode as ViewMode)}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/30 transition-colors text-left"
                        >
                          <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{view.label}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{VIEW_DESCRIPTIONS[(view.viewMode || '') as ViewMode] || ''}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Child spaces */}
          {spaceTree.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Sous-espaces ({childSpaces?.length || 0})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {spaceTree.map(node => (
                  <Link
                    key={node.id}
                    to={`/spaces/${node.id}`}
                    className="block rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all overflow-hidden"
                  >
                    {node.coverUrl ? (
                      <div className="h-20 overflow-hidden">
                        <img src={node.coverUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `center ${(node as any).coverPosition ?? 50}%` }} />
                      </div>
                    ) : (
                      <div className="h-20 bg-gradient-to-r from-primary/10 to-primary/5" />
                    )}
                    <div className="p-3 flex items-center gap-3">
                      {node.avatarUrl ? (
                        <img src={node.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{node.name}</p>
                        <p className="text-xs text-muted-foreground">{(node as any).itemCount || 0} elements</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {user && (
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
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
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
          )}
        </div>
      </div>
    </div>
  );
}

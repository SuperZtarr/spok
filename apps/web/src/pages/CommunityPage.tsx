import { useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FolderOpen, Settings, Globe, Lock, Crown, User } from 'lucide-react';
import { communitiesApi, spacesApi, userTasksApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { useViewModeStore } from '../stores/viewMode';
import { Button } from '../components/ui/Button';
import { RoleGuard } from '../components/RoleGuard';
import { SpaceCard } from '../components/ui/SpaceCard';
import { useAdminMode } from '../components/DevDbStatus';
// Types used implicitly via API responses

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

function SpaceTreeNode({ node, depth = 0, activityBySpace }: { node: any; depth?: number; activityBySpace: Map<string, number> }) {
  const hasChildren = node.children?.length > 0;
  const indent = depth > 0 ? `${depth * 2.5}rem` : undefined;
  if (!hasChildren) {
    return (
      <div className="col-span-full" style={{ paddingLeft: indent }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <SpaceCard space={node} onClick={() => useViewModeStore.getState().setMode('overview')} activityCount={activityBySpace.get(node.id)} />
        </div>
      </div>
    );
  }
  return (
    <div className="col-span-full">
      <div style={{ paddingLeft: indent }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <SpaceCard space={node} onClick={() => useViewModeStore.getState().setMode('overview')} activityCount={activityBySpace.get(node.id)} />
        </div>
      </div>
      <div className="mt-2">
        {node.children.map((child: any) => (
          <SpaceTreeNode key={child.id} node={child} depth={depth + 1} activityBySpace={activityBySpace} />
        ))}
      </div>
    </div>
  );
}

const ALL_TYPES = 'NOTE,PROJECT,TASK,MEETING,PERIOD,LINK,CONFIG,DOCUMENT,IMAGE,BUG,DIAGRAM';

export function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { setCurrentCommunity } = useCommunityStore();
  // Depuis la dernière connexion (fallback : 7 jours)
  const updatedAfter = useRef(user?.lastLoginAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  // Set current community for spaces navigation
  useEffect(() => {
    if (community) {
      setCurrentCommunity(community as any);
    }
  }, [community, setCurrentCommunity]);

  const { data: members } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId!),
    enabled: !!communityId && !!user,
  });

  const { data: spaces } = useQuery({
    queryKey: ['spaces', communityId],
    queryFn: () => spacesApi.list(communityId!),
    enabled: !!communityId,
  });

  const { data: recentData } = useQuery({
    queryKey: ['community-recent-items', communityId, updatedAfter.current],
    queryFn: () => userTasksApi.list({ type: ALL_TYPES, updatedAfter: updatedAfter.current, pageSize: 2000 }),
    enabled: !!user && !!communityId,
  });

  const adminMode = useAdminMode();
  const isAdminOrOwner = community?.role === 'OWNER' || community?.role === 'ADMIN_VIEW' || adminMode;

  // Sort members: OWNER first, then MEMBER
  const roleOrder: Record<string, number> = { OWNER: 0, MEMBER: 1 };
  const sortedMembers = [...(members || [])].sort((a, b) =>
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  // Count recent activity per spaceId (filtered to this community's spaces)
  const activityBySpace = useMemo(() => {
    const communitySpaceIds = new Set((spaces || []).map(s => s.id));
    const bySpace = new Map<string, number>();
    for (const item of (recentData?.data || [])) {
      if (communitySpaceIds.has(item.spaceId)) {
        bySpace.set(item.spaceId, (bySpace.get(item.spaceId) || 0) + 1);
      }
    }
    return bySpace;
  }, [recentData, spaces]);

  // Build space tree from flat list
  const spaceTree = useMemo(() => {
    if (!spaces) return [];
    type SpaceNode = (typeof spaces)[number] & { children: SpaceNode[] };
    const map = new Map<string, SpaceNode>();
    const roots: SpaceNode[] = [];
    spaces.forEach(s => map.set(s.id, { ...s, children: [] }));
    spaces.forEach(s => {
      if (s.parentId && map.has(s.parentId)) {
        map.get(s.parentId)!.children.push(map.get(s.id)!);
      } else {
        roots.push(map.get(s.id)!);
      }
    });
    return roots;
  }, [spaces]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full px-4 sm:px-6">
        {/* Header with cover */}
        <div className="relative mt-4">
          {community?.coverUrl ? (
            <div className="aspect-[5/1] rounded-xl overflow-hidden"><img src={community.coverUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${(community as any).coverPositionX ?? 50}% ${(community as any).coverPosition ?? 50}%`, transform: `scale(${((community as any).coverZoom ?? 100) / 100})`, transformOrigin: `${(community as any).coverPositionX ?? 50}% ${(community as any).coverPosition ?? 50}%` }} /></div>
          ) : (
            <div className="aspect-[5/1] bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl" />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent h-16 rounded-b-xl" />
        </div>

      <div className="-mt-8 relative z-10">
        {/* Community info */}
        <div className="flex items-end gap-4 mb-6">
          {community?.avatarUrl ? (
            <img src={community.avatarUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" />
          ) : community?.coverUrl ? (
            <img src={community.coverUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
          ) : (
            <div className="w-16 h-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
              <Users className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{community?.name}</h1>
              {community?.isPublic ? (
                <span title="Communauté publique"><Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" /></span>
              ) : (
                <span title="Communauté privée"><Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" /></span>
              )}
            </div>
            {community?.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{community.description}</p>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            {isAdminOrOwner && (
              <RoleGuard role="OWNER">
                <Button variant="outline" size="sm" onClick={() => navigate(`/communities/${communityId}/settings`)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </RoleGuard>
            )}
          </div>
        </div>

        {/* Main content: spaces + members side by side */}
        <div className="flex gap-6 mb-8">
          {/* Spaces column */}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Espaces ({spaces?.length || 0})
            </h2>
            {spaceTree.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {spaceTree.map(node => (
                  <SpaceTreeNode key={node.id} node={node} activityBySpace={activityBySpace} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun espace dans cette communauté.</p>
            )}
          </div>

          {/* Members column (authenticated only) */}
          {user && (
            <div className="w-64 flex-shrink-0">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Membres ({sortedMembers.length})
              </h2>
              <div className="flex flex-col gap-1">
                {sortedMembers.map(member => {
                  const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.MEMBER;
                  const RoleIcon = config.icon;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium flex-shrink-0">
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
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

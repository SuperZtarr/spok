import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FolderOpen, Settings, Globe, Lock, Crown, User, ChevronRight, Info } from 'lucide-react';
import { communitiesApi, spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { RoleGuard } from '../components/RoleGuard';
// Types used implicitly via API responses

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

function SpaceTreeNode({ node, level }: { node: any; level: number }) {
  return (
    <>
      <div className="flex items-center gap-1" style={{ marginLeft: `${level * 24}px` }}>
        <Link
          to={`/spaces/${node.id}`}
          className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
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
        <Link
          to={`/spaces/${node.id}`}
          className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
          title="Présentation de l'espace"
        >
          <Info className="w-4 h-4" />
        </Link>
      </div>
      {node.children?.map((child: any) => (
        <SpaceTreeNode key={child.id} node={child} level={level + 1} />
      ))}
    </>
  );
}

export function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  const { data: members } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId!),
    enabled: !!communityId,
  });

  const { data: spaces } = useQuery({
    queryKey: ['spaces', communityId],
    queryFn: () => spacesApi.list(communityId!),
    enabled: !!communityId,
  });

  const isAdminOrOwner = community?.role === 'OWNER';

  // Sort members: OWNER first, then MEMBER
  const roleOrder: Record<string, number> = { OWNER: 0, MEMBER: 1 };
  const sortedMembers = [...(members || [])].sort((a, b) =>
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

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
      {/* Header with cover */}
      <div className="relative">
        {community?.coverUrl ? (
          <div className="aspect-[3/1] bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
        ) : (
          <div className="aspect-[3/1] bg-gradient-to-r from-primary/20 to-primary/5" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent h-16" />
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        {/* Community info */}
        <div className="flex items-end gap-4 mb-6">
          {community?.avatarUrl ? (
            <img src={community.avatarUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" />
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

        {/* Spaces section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Espaces ({spaces?.length || 0})
          </h2>
          {spaceTree.length > 0 ? (
            <div className="space-y-1">
              {spaceTree.map(node => (
                <SpaceTreeNode key={node.id} node={node} level={0} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun espace dans cette communauté.</p>
          )}
        </div>

        {/* Members section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Membres ({sortedMembers.length})
          </h2>
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
        </div>
      </div>

    </div>
  );
}

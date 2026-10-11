/* Page communauté (/communities/:id) : cover, espaces en arborescence, membres, activité.
   Bouton « Nouvel espace » (2026-10-10) : membres (OWNER/MEMBER) et admin en mode admin, comme
   l'autorise l'API POST /spaces — formulaire nom + « Espace parent » (espaces de la communauté,
   arbre indenté, défaut racine → sous-espace sinon), ouvre l'espace créé. Choix de modèle :
   rester sur le Tableau de bord, ne pas dupliquer ici.
   Vignettes d'espace : pastille de visibilité effective (visibilityBySpace, résolue côté client avec
   la règle de getEffectiveVisibility), en pointillé quand elle est héritée. En-tête : même pastille
   pour la communauté, lue sur visibility (jamais isPublic, déprécié). */
import { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FolderOpen, Settings, Crown, User, Plus } from 'lucide-react';
import { communitiesApi, spacesApi, activityApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useCommunityStore } from '../stores/community';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { RoleGuard } from '../components/RoleGuard';
import { SpaceCard } from '../components/ui/SpaceCard';
import { VisibilityPill } from '../components/ui/VisibilityPill';
import { useAdminMode } from '../components/DevDbStatus';
// Types used implicitly via API responses

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

type SpaceVisibilityInfo = { value: string; inheritedFrom: 'parent' | 'community' | null };

function SpaceTreeNode({ node, depth = 0, activityBySpace, visibilityBySpace }: { node: any; depth?: number; activityBySpace: Map<string, number>; visibilityBySpace: Map<string, SpaceVisibilityInfo> }) {
  const hasChildren = node.children?.length > 0;
  const indent = depth > 0 ? `${depth * 2.5}rem` : undefined;
  if (!hasChildren) {
    return (
      <div className="col-span-full" style={{ paddingLeft: indent }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <SpaceCard space={node} onClick={undefined} activityCount={activityBySpace.get(node.id)} visibility={visibilityBySpace.get(node.id)} />
        </div>
      </div>
    );
  }
  return (
    <div className="col-span-full">
      <div style={{ paddingLeft: indent }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <SpaceCard space={node} onClick={undefined} activityCount={activityBySpace.get(node.id)} visibility={visibilityBySpace.get(node.id)} />
        </div>
      </div>
      <div className="mt-2">
        {node.children.map((child: any) => (
          <SpaceTreeNode key={child.id} node={child} depth={depth + 1} activityBySpace={activityBySpace} visibilityBySpace={visibilityBySpace} />
        ))}
      </div>
    </div>
  );
}

export function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { setCurrentCommunity } = useCommunityStore();

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

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.feed(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });

  const adminMode = useAdminMode();
  const isAdminOrOwner = community?.role === 'OWNER' || community?.role === 'ADMIN_VIEW' || adminMode;
  const canCreateSpace = !!user && (community?.role === 'OWNER' || community?.role === 'MEMBER' || adminMode);

  const queryClient = useQueryClient();
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceParentId, setNewSpaceParentId] = useState('');
  const closeCreateSpace = () => { setShowCreateSpace(false); setNewSpaceName(''); setNewSpaceParentId(''); };
  const createSpaceMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string }) =>
      spacesApi.create({ name, type: 'GROUP', communityId, parentId: parentId || undefined }),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      closeCreateSpace();
      navigate(`/spaces/${space.id}`);
    },
  });
  const submitNewSpace = () => {
    const name = newSpaceName.trim();
    if (name && !createSpaceMutation.isPending) createSpaceMutation.mutate({ name, parentId: newSpaceParentId });
  };

  // Sort members: OWNER first, then MEMBER
  const roleOrder: Record<string, number> = { OWNER: 0, MEMBER: 1 };
  const sortedMembers = [...(members || [])].sort((a, b) =>
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  const activityBySpace = useMemo(() => {
    const bySpace = new Map<string, number>();
    const group = (activityData?.groups ?? []).find((g: any) => g.community.id === communityId);
    if (group) {
      for (const spaceGroup of group.spaces) {
        bySpace.set(spaceGroup.space.id, spaceGroup.items.length);
      }
    }
    return bySpace;
  }, [activityData, communityId]);

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

  // Visibilité effective de chaque espace, même règle que getEffectiveVisibility (API) :
  // propre → espace parent → communauté. Parent absent de la liste (inaccessible) → communauté.
  const visibilityBySpace = useMemo(() => {
    const result = new Map<string, SpaceVisibilityInfo>();
    if (!spaces) return result;
    const byId = new Map(spaces.map(s => [s.id, s as typeof s & { visibility?: string | null }]));
    const communityVisibility = (community as any)?.visibility ?? 'PRIVATE';
    const resolve = (id: string, seen: Set<string>): SpaceVisibilityInfo => {
      const cached = result.get(id);
      if (cached) return cached;
      const space = byId.get(id)!;
      let info: SpaceVisibilityInfo;
      if (space.visibility) info = { value: space.visibility, inheritedFrom: null };
      else if (space.parentId && byId.has(space.parentId) && !seen.has(space.parentId)) {
        info = { value: resolve(space.parentId, seen.add(id)).value, inheritedFrom: 'parent' };
      } else info = { value: communityVisibility, inheritedFrom: 'community' };
      result.set(id, info);
      return info;
    };
    spaces.forEach(s => resolve(s.id, new Set()));
    return result;
  }, [spaces, community]);

  // Options « Espace parent » du formulaire de création : arbre aplati, indenté par niveau
  const parentSpaceOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [{ value: '', label: 'Aucun (espace racine)' }];
    const walk = (nodes: typeof spaceTree, depth: number) => {
      nodes.forEach(n => {
        if (n.type === 'GROUP') options.push({ value: n.id, label: `${'   '.repeat(depth)}${depth > 0 ? '└ ' : ''}${n.name}` });
        walk(n.children, depth + 1);
      });
    };
    walk(spaceTree, 0);
    return options;
  }, [spaceTree]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="w-full px-4 sm:px-6">
        {/* Header with cover */}
        <div className="relative mt-4 max-w-5xl">
          {community?.coverUrl ? (
            <div className="aspect-[5/1] max-h-40 rounded-xl overflow-hidden"><img src={community.coverUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${(community as any).coverPositionX ?? 50}% ${(community as any).coverPosition ?? 50}%`, transform: `scale(${((community as any).coverZoom ?? 100) / 100})`, transformOrigin: `${(community as any).coverPositionX ?? 50}% ${(community as any).coverPosition ?? 50}%` }} /></div>
          ) : (
            <div className="aspect-[5/1] max-h-40 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl" />
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
              {community && <VisibilityPill visibility={(community as any).visibility} className="flex-shrink-0" />}
            </div>
            {community?.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{community.description}</p>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            {isAdminOrOwner && (
              <RoleGuard role="OWNER">
                <Button variant="bordered" size="sm" onClick={() => navigate(`/communities/${communityId}/settings`)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </RoleGuard>
            )}
          </div>
        </div>

        {/* Main content: spaces + members side by side */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-8">
          {/* Spaces column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Espaces ({spaces?.length || 0})
              </h2>
              {canCreateSpace && !showCreateSpace && (
                <Button size="sm" onClick={() => setShowCreateSpace(true)}>
                  <Plus className="w-4 h-4" />
                  Nouvel espace
                </Button>
              )}
            </div>
            {showCreateSpace && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-muted/50 space-y-3">
                <Input
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Nom de l'espace"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewSpace();
                    if (e.key === 'Escape') closeCreateSpace();
                  }}
                  autoFocus
                />
                {parentSpaceOptions.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Espace parent</label>
                    <Select
                      value={newSpaceParentId}
                      onChange={(e) => setNewSpaceParentId(e.target.value)}
                      options={parentSpaceOptions}
                    />
                  </div>
                )}
                {createSpaceMutation.isError && (
                  <p className="text-xs text-destructive">La création a échoué. Réessaie.</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitNewSpace} disabled={!newSpaceName.trim() || createSpaceMutation.isPending}>
                    {createSpaceMutation.isPending ? 'Création...' : 'Créer'}
                  </Button>
                  <Button size="sm" variant="bordered" onClick={closeCreateSpace}>Annuler</Button>
                </div>
              </div>
            )}
            {spaceTree.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {spaceTree.map(node => (
                  <SpaceTreeNode key={node.id} node={node} activityBySpace={activityBySpace} visibilityBySpace={visibilityBySpace} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun espace dans cette communauté.</p>
            )}
          </div>

          {/* Members column (authenticated only) */}
          {user && (
            <div className="w-full md:w-64 md:flex-shrink-0">
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

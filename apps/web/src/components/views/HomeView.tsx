import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Globe, Lock, Crown, User, FolderKanban, FolderOpen, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { communitiesApi, spacesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { SpaceWithRole, CommunityWithRole } from '@spok/shared';

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  ADMIN: { label: 'Admin', icon: Crown, color: 'text-blue-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
  VIEWER: { label: 'Lecteur', icon: User, color: 'text-muted-foreground' },
};

function CommunityCard({
  community,
  spaces,
}: {
  community: CommunityWithRole;
  spaces: SpaceWithRole[];
}) {
  const [expanded, setExpanded] = useState(false);
  const config = ROLE_CONFIG[community.role || 'MEMBER'] || ROLE_CONFIG.MEMBER;
  const RoleIcon = config.icon;
  const rootSpaces = spaces.filter(s => !s.parentId || !spaces.some(p => p.id === s.parentId));

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Community header — clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left hover:bg-accent/50 transition-colors"
      >
        {/* Cover */}
        {community.coverUrl ? (
          <div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
        ) : (
          <div className="h-20 bg-gradient-to-r from-primary/20 to-primary/5" />
        )}

        <div className="relative px-4 pb-3 pt-7">
          {/* Avatar overlay */}
          <div className="absolute -top-5 left-4">
            {community.avatarUrl ? (
              <img src={community.avatarUrl} alt="" className="w-10 h-10 rounded-xl border-3 border-background object-cover shadow" />
            ) : (
              <div className="w-10 h-10 rounded-xl border-3 border-background bg-primary/10 flex items-center justify-center shadow">
                <Users className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold truncate">{community.name}</h3>
              {community.isPublic ? (
                <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5" />
                {spaces.length}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RoleIcon className={`w-3.5 h-3.5 ${config.color}`} />
                {config.label}
              </span>
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {community.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{community.description}</p>
          )}
        </div>
      </button>

      {/* Expanded space list */}
      {expanded && (
        <div className="border-t border-border bg-muted/30">
          {rootSpaces.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-3">Aucun espace dans cette communauté.</p>
          ) : (
            <div className="divide-y divide-border">
              {rootSpaces.map(space => (
                <SpaceRow key={space.id} space={space} allSpaces={spaces} level={0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpaceRow({
  space,
  allSpaces,
  level,
}: {
  space: SpaceWithRole;
  allSpaces: SpaceWithRole[];
  level: number;
}) {
  const children = allSpaces.filter(s => s.parentId === space.id);
  const isMember = !!space.role;

  return (
    <>
      <Link
        to={`/spaces/${space.id}/content`}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
        style={{ paddingLeft: `${16 + level * 20}px` }}
      >
        {space.avatarUrl ? (
          <img src={space.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
        ) : (
          <FolderKanban className={`w-4 h-4 flex-shrink-0 ${isMember ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
        <span className={`text-sm truncate ${isMember ? 'font-medium' : 'text-muted-foreground'}`}>
          {space.name}
        </span>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1 flex-shrink-0">
          <FileText className="w-3 h-3" />
          {space.itemCount || 0}
        </span>
      </Link>
      {children.map(child => (
        <SpaceRow key={child.id} space={child} allSpaces={allSpaces} level={level + 1} />
      ))}
    </>
  );
}

export function HomeView() {
  const user = useAuthStore(s => s.user);

  const { data: communities, isLoading: loadingCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  const { data: allSpaces, isLoading: loadingSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  const isLoading = loadingCommunities || loadingSpaces;

  // Group spaces by community
  const spacesByCommunity = new Map<string, SpaceWithRole[]>();
  const personalSpaces: SpaceWithRole[] = [];
  const independentSpaces: SpaceWithRole[] = [];

  if (allSpaces) {
    for (const space of allSpaces) {
      if (space.type === 'PERSONAL') {
        personalSpaces.push(space);
      } else if (space.communityId) {
        const list = spacesByCommunity.get(space.communityId) || [];
        list.push(space);
        spacesByCommunity.set(space.communityId, list);
      } else {
        independentSpaces.push(space);
      }
    }
  }

  // First name
  const firstName = user?.name?.split(' ')[0] || '';

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  }

  const totalSpaces = allSpaces?.length || 0;
  const totalCommunities = communities?.length || 0;

  return (
    <div className="p-8 flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Welcome banner */}
        <div className="mb-8" data-tour="home-welcome">
          <h1 className="text-2xl font-bold">Bonjour {firstName}</h1>
          <p className="text-muted-foreground mt-1">
            {totalCommunities} communauté{totalCommunities > 1 ? 's' : ''}
            {' · '}
            {totalSpaces} espace{totalSpaces > 1 ? 's' : ''}
          </p>
        </div>

        {/* Communities */}
        {communities && communities.length > 0 && (
          <section className="mb-8" data-tour="home-communities">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Mes communautés
            </h2>
            <div className="space-y-3">
              {communities.map(community => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  spaces={spacesByCommunity.get(community.id) || []}
                />
              ))}
            </div>
          </section>
        )}

        {/* Personal spaces */}
        {personalSpaces.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Espaces personnels
            </h2>
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {personalSpaces.map(space => (
                <SpaceRow key={space.id} space={space} allSpaces={personalSpaces} level={0} />
              ))}
            </div>
          </section>
        )}

        {/* Independent group spaces */}
        {independentSpaces.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Espaces de groupe
            </h2>
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {independentSpaces.map(space => (
                <SpaceRow key={space.id} space={space} allSpaces={independentSpaces} level={0} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

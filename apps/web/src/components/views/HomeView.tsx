import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Globe, Lock, Crown, User, FolderKanban, FolderOpen, FileText, ChevronDown, ChevronRight, Rocket, LogIn, Plus, ArrowRight } from 'lucide-react';
import { communitiesApi, spacesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useDashboardTabStore } from '../../stores/dashboardTab';
import type { SpaceWithRole, CommunityWithRole } from '@spok/shared';

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
        {/* Welcome */}
        <div className="text-center mb-10">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">Bienvenue {userName} !</h1>
          <p className="text-muted-foreground mt-2">
            C'est votre premier pas sur SPOK. Commencez par rejoindre une communauté ou créez la vôtre.
          </p>
        </div>

        {/* Step 1: Join a public community */}
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

        {/* Step 2: Create your own community */}
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
            onClick={() => { useDashboardTabStore.getState().setTab('communities'); navigate('/'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer une communauté
            <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
          </button>
        </section>

        {/* Step 3: Create a personal space */}
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
            onClick={() => { useDashboardTabStore.getState().setTab('spaces'); navigate('/?new=space'); }}
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
          <div className="aspect-[3/1] bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
        ) : (
          <div className="aspect-[3/1] bg-gradient-to-r from-primary/20 to-primary/5" />
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
        to={`/spaces/${space.id}`}
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

  // First time setup for users with no communities and no spaces
  if (totalCommunities === 0 && totalSpaces === 0 && !isLoading) {
    return <FirstTimeSetup userName={firstName} />;
  }

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

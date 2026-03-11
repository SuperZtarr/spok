import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Globe, Lock, Crown, Shield, User, Eye, FolderOpen } from 'lucide-react';
import { communitiesApi } from '../../lib/api';

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-blue-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
  VIEWER: { label: 'Lecteur', icon: Eye, color: 'text-muted-foreground' },
};

export function CommunityListView() {
  const { data: communities, isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Chargement...</div>
    );
  }

  if (!communities || communities.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium">Aucune communauté</p>
          <p className="text-sm text-muted-foreground">Vous ne faites partie d'aucune communauté pour le moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map(community => {
            const config = ROLE_CONFIG[community.role || 'MEMBER'] || ROLE_CONFIG.MEMBER;
            const RoleIcon = config.icon;
            return (
              <Link
                key={community.id}
                to={`/communities/${community.id}`}
                className="group relative border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Cover */}
                {community.coverUrl ? (
                  <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
                ) : (
                  <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                )}

                {/* Avatar overlay */}
                <div className="absolute top-16 left-4">
                  {community.avatarUrl ? (
                    <img src={community.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="pt-8 px-4 pb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{community.name}</h3>
                    {community.isPublic ? (
                      <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {community.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {community.memberCount || 0} membre{(community.memberCount || 0) > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {community.spaceCount || 0} espace{(community.spaceCount || 0) > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <RoleIcon className={`w-3.5 h-3.5 ${config.color}`} />
                      {config.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

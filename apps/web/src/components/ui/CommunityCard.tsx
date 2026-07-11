/* Carte de communauté (listes/accueil) : nom, visibilité, compteurs, cover. */
import { Link } from 'react-router-dom';
import { Users, Globe, Lock, Crown, User, Eye, Mail, ShieldCheck, FolderOpen, Clock, Bell, BellOff, LogOut } from 'lucide-react';
import { Button } from './Button';

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER:      { label: 'Propriétaire', icon: Crown,      color: 'text-amber-500' },
  MEMBER:     { label: 'Membre',       icon: User,       color: 'text-foreground' },
  VIEWER:     { label: 'Visiteur',     icon: Eye,        color: 'text-muted-foreground' },
  INVITED:    { label: 'Invitation',   icon: Mail,       color: 'text-orange-500' },
  ADMIN_VIEW: { label: 'Admin',        icon: ShieldCheck, color: 'text-purple-500' },
};

interface Community {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  coverPosition?: number;
  coverPositionX?: number;
  coverZoom?: number;
  isPublic?: boolean;
  memberCount?: number;
  spaceCount?: number;
  role?: string | null;
  muted?: boolean;
  pendingPublic?: boolean;
}

// =============================================================================
// Sous-composant : visuel cover + avatar (partagé entre les deux variantes)
// =============================================================================

function CoverWithAvatar({ community, bannerHeight }: { community: Community; bannerHeight: string }) {
  return (
    <>
      {community.coverUrl ? (
        <div className={`${bannerHeight} overflow-hidden`}>
          <img
            src={community.coverUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${community.coverPositionX ?? 50}% ${community.coverPosition ?? 50}%`,
              transform: `scale(${(community.coverZoom ?? 100) / 100})`,
              transformOrigin: `${community.coverPositionX ?? 50}% ${community.coverPosition ?? 50}%`,
            }}
          />
        </div>
      ) : (
        <div className={`${bannerHeight} bg-gradient-to-r from-primary/20 to-primary/5`} />
      )}
      <div className="absolute -bottom-4 left-4">
        {community.avatarUrl ? (
          <img src={community.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
        ) : community.coverUrl ? (
          <img src={community.coverUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
        ) : (
          <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
            <Users className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// Variante "banner" — utilisée dans ActivityPage (cover + avatar + nom + mute)
// =============================================================================

interface CommunityBannerProps {
  community: Community;
  isMuted?: boolean;
  onMute?: (muted: boolean) => void;
  isMutePending?: boolean;
}

export function CommunityBanner({ community, isMuted, onMute, isMutePending }: CommunityBannerProps) {
  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden">
      <div className="relative">
        <CoverWithAvatar community={community} bannerHeight="h-28" />
      </div>
      {onMute && (
        <button
          onClick={() => onMute(!isMuted)}
          disabled={isMutePending}
          className={`absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
            isMuted
              ? 'bg-black/40 text-white/70 border-white/20'
              : 'bg-black/30 text-white/80 border-white/20 hover:bg-black/50'
          }`}
          title={isMuted ? 'Réactiver' : 'Ignorer cette communauté'}
        >
          {isMuted ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
          {isMuted ? 'Muté' : 'Muter'}
        </button>
      )}
      <div className="px-4 pt-6 pb-3">
        <p className="font-semibold text-sm">{community.name}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Variante "card" — utilisée dans CommunityListView (full card avec stats/boutons)
// =============================================================================

interface CommunityCardProps {
  community: Community;
  to?: string;
  onMute?: (muted: boolean) => void;
  isMutePending?: boolean;
  onLeave?: () => void;
  isLeavePending?: boolean;
}

export function CommunityCard({ community, to, onMute, isMutePending, onLeave, isLeavePending }: CommunityCardProps) {
  const config = ROLE_CONFIG[community.role || 'MEMBER'] || ROLE_CONFIG.MEMBER;
  const RoleIcon = config.icon;
  const showMuteButton = onMute && ['OWNER', 'MEMBER', 'VIEWER'].includes(community.role || '');
  const showLeaveButton = onLeave && community.role === 'MEMBER';

  return (
    <Link
      to={to ?? `/communities/${community.id}`}
      className="group relative border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all bg-card"
    >
      <div className="relative">
        <CoverWithAvatar community={community} bannerHeight="aspect-[3/1]" />
      </div>

      {community.pendingPublic && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-medium">
          <Clock className="w-3 h-3" />
          Publication en attente
        </div>
      )}

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

        {(showMuteButton || showLeaveButton) && (
          <div className="flex items-center justify-between mt-3">
            {showMuteButton && (
              <Button
                size="sm"
                variant="bordered"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMute!(!community.muted); }}
                className={`flex items-center gap-1 text-xs ${community.muted ? 'bg-orange-100 text-orange-700 border-orange-400 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-600' : ''}`}
                title={community.muted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
                disabled={isMutePending}
              >
                {community.muted ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                {community.muted ? 'Sourdine' : 'Notifier'}
              </Button>
            )}
            {showLeaveButton && (
              <Button
                size="sm"
                variant="bordered"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLeave!(); }}
                className="flex items-center gap-1 text-xs hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                disabled={isLeavePending}
              >
                <LogOut className="w-3 h-3" />
                Quitter
              </Button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { Clock, FolderOpen } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';

interface SpaceCardProps {
  space: SpaceWithRole;
  onClick?: () => void;
  activityCount?: number;
  to?: string;
}

export function SpaceCard({ space, onClick, activityCount, to }: SpaceCardProps) {
  return (
    <Link
      to={to ?? `/spaces/${space.id}`}
      onClick={onClick}
      className="block rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all overflow-hidden"
    >
      {space.coverUrl ? (
        <div className="h-24 overflow-hidden">
          <img
            src={space.coverUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${(space as any).coverPositionX ?? 50}% ${(space as any).coverPosition ?? 50}%`,
              transform: `scale(${((space as any).coverZoom ?? 100) / 100})`,
              transformOrigin: `${(space as any).coverPositionX ?? 50}% ${(space as any).coverPosition ?? 50}%`,
            }}
          />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5" />
      )}
      <div className="p-3 flex items-center gap-3">
        {space.avatarUrl ? (
          <img src={space.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
        ) : space.coverUrl ? (
          <img src={space.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" style={{ objectPosition: 'top right' }} />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{space.name}</p>
          <p className="text-xs text-muted-foreground">
            {(space as any).itemCount || 0} element{((space as any).itemCount || 0) > 1 ? 's' : ''}
          </p>
        </div>
        {activityCount != null && activityCount > 0 && (
          <span className="animate-pulse shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-500 text-white shadow-sm">
            <Clock className="w-3 h-3" />
            {activityCount > 99 ? '99+' : activityCount}
          </span>
        )}
      </div>
    </Link>
  );
}

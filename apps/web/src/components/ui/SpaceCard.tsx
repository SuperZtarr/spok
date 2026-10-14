/* Carte d'espace (listes/accueil) : nom, communauté, compteurs, cover.
   Prop visibility (optionnelle) : visibilité effective déjà résolue par l'appelant (espace → parent →
   communauté) + inheritedFrom ; la pastille n'apparaît que si elle est fournie.
   Pastille + raccourcis groupés sur une dernière ligne alignée à droite, sous le nom (le nom garde sa largeur) (showActions, défaut true ; false pour les aperçus des pages
   de paramètres) : « vue par défaut » (/spaces/:id?view=<defaultView|list>, force la vue au lieu de la
   dernière utilisée) et paramètres (OWNER de l'espace ou admin en mode admin, même règle que la page).
   Boutons dans un Link : preventDefault + stopPropagation obligatoires. */
import { Link, useNavigate } from 'react-router-dom';
import { Clock, FolderOpen, Settings } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';
import { VisibilityPill } from './VisibilityPill';
import { VIEW_MODES } from '../../stores/viewMode';
import { getViewIcon } from '../../constants/viewIcons';
import { useAdminMode } from '../DevDbStatus';

// Vue réellement ouverte quand l'espace n'a pas de vue par défaut (cf. SpacePage)
const FALLBACK_VIEW = 'list';

interface SpaceCardProps {
  space: SpaceWithRole;
  onClick?: () => void;
  activityCount?: number;
  to?: string;
  visibility?: { value: string; inheritedFrom: 'parent' | 'community' | null };
  showActions?: boolean;
}

const ACTION_BUTTON = 'p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors';

export function SpaceCard({ space, onClick, activityCount, to, visibility, showActions = true }: SpaceCardProps) {
  const navigate = useNavigate();
  const adminMode = useAdminMode();
  const canEditSettings = space.role === 'OWNER' || adminMode;
  const defaultView = (space as any).defaultView || FALLBACK_VIEW;
  const viewMeta = VIEW_MODES.find(v => v.value === defaultView);
  const ViewIcon = getViewIcon(viewMeta?.icon ?? '');

  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(path);
  };

  return (
    <Link
      data-tour="space-card"
      to={to ?? `/spaces/${space.id}`}
      onClick={onClick}
      className="block rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all overflow-hidden"
    >
      <div className="relative">
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
      </div>
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
      {(visibility || showActions) && (
          <div className="flex items-center justify-end gap-0.5 px-3 pb-2 -mt-1">
            {visibility && (
              <VisibilityPill visibility={visibility.value} entity="space" inheritedFrom={visibility.inheritedFrom} className="mr-1" />
            )}
            {showActions && (
              <button
                type="button"
                data-tour="space-card-open-view"
                onClick={(e) => go(e, `/spaces/${space.id}?view=${defaultView}`)}
                className={ACTION_BUTTON}
                title={`Ouvrir la vue par défaut : ${viewMeta?.label ?? defaultView}`}
                aria-label={`Ouvrir la vue par défaut : ${viewMeta?.label ?? defaultView}`}
              >
                <ViewIcon className="w-4 h-4" />
              </button>
            )}
            {showActions && canEditSettings && (
              <button
                type="button"
                onClick={(e) => go(e, `/spaces/${space.id}/settings`)}
                className={ACTION_BUTTON}
                title="Paramètres de l'espace"
                aria-label="Paramètres de l'espace"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
      )}
    </Link>
  );
}

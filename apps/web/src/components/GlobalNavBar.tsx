/**
 * Barre de navigation globale (bandeau bas, desktop uniquement).
 * Affiche les sections de menu issues de useMenuItems, filtrées par mode d'interface.
 * Déconnexion, toggles mode admin/dev et bouton "Retourner à" ont été déplacés dans la
 * row 1 du header (Layout.tsx, 2026-08-31) — ce bandeau ne gère plus que la navigation.
 * Badge d'activité : GET /activity seulement si connecté — le bandeau s'affiche aussi aux visiteurs anonymes
 * (/communities, /search…) et un 401 y renvoyait vers /login (bug 2026-10-21).
 * Icônes : getNavIcon de constants/viewIcons.ts, source unique (2026-11-13) — plus de carte NAV_ICONS ici ni dans Layout.
 * Ligne Administration (2026-11-19) : en mode admin (useAdminMode), une ligne sous le bandeau affiche la section `admin`
 * de useMenuItems (MENU_REGISTRY) — remplace l'ancien bloc du pied de sidebar devenu trop long. Desktop uniquement ;
 * sur mobile les entrées admin restent dans la grille de navigation de la sidebar. Pas de dropdown (cf. spok-layout).
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getNavIcon } from '../constants/viewIcons';
import { activityApi } from '../lib/api';
import { useMenuItems } from '../hooks/useMenuItems';
import { resolveMenuRoute } from '../lib/searchScope';
import { useInterfaceModeStore, MODE_GLOBAL_EXCLUDED } from '../stores/interfaceMode';
import { useAuthStore } from '../stores/auth';
import { useAdminMode } from './DevDbStatus';
import { SPACE_VIEW_SECTION_IDS, type MenuItemConfig } from '@spok/shared';

const getIcon = getNavIcon;

/** Sections qui ont leurs propres vues dans la SpaceToolbar — exclues ici (liste partagée, 5 catégories depuis 2026-11-13) */
const SPACE_SECTIONS = SPACE_VIEW_SECTION_IDS;
/** Clés gérées ailleurs : profil (modale header), déconnexion (row 1 du header) */
const EXCLUDED_KEYS = new Set(['profile', 'logout']);

export function GlobalNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sections } = useMenuItems();
  const { mode: interfaceMode } = useInterfaceModeStore();
  const user = useAuthStore((s) => s.user);

  const handleItemClick = (item: MenuItemConfig) => {
    // Recherche : portée par défaut = espace/communauté courant (cf. lib/searchScope)
    if (item.route) navigate(resolveMenuRoute(item.key, item.route, location.pathname));
  };

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.feed(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });
  const activityCount = activityData?.total ?? 0;

  const adminMode = useAdminMode();
  const navSections = sections.filter(s => !SPACE_SECTIONS.has(s.id) && s.id !== 'admin');
  const adminSection = adminMode ? sections.find(s => s.id === 'admin') : undefined;
  const adminItems = (adminSection?.items ?? []).filter(item => item.route);

  const isActive = (item: MenuItemConfig): boolean => {
    if (!item.route) return false;
    if (item.route === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.route);
  };

  return (
    <>
    <div data-devzone="bandeau" className="hidden md:flex items-start gap-3 overflow-x-auto scrollbar-none px-4 py-1.5 border-t border-border/50 relative">
      {navSections.map(section => {
        const items = section.items.filter(item =>
          !EXCLUDED_KEYS.has(item.key) &&
          !(MODE_GLOBAL_EXCLUDED[interfaceMode]?.has(item.key))
        );
        if (items.length === 0) return null;

        return (
          <div key={section.id} className={`flex flex-col gap-0.5 flex-shrink-0${section.id === 'misc' ? ' ml-auto' : ''}`}>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              {section.label}
            </span>
            <div className="flex items-center gap-0.5">
              {items.map(item => {
                const Icon = getIcon(item.icon);
                const active = isActive(item);
                return (
                  <button
                    key={item.key}
                    data-tour={`nav-${item.key}`}
                    onClick={() => handleItemClick(item)}
                    title={item.label}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="hidden sm:inline">{item.label}</span>
                    {item.key === 'activity' && activityCount > 0 && (
                      <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1 leading-none min-w-[1rem] text-center">
                        {activityCount > 99 ? '99+' : activityCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

    </div>
    {adminItems.length > 0 && (
      <div data-devzone="bandeau-admin" className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-none px-4 py-1 border-t border-red-200/60 dark:border-red-900/40">
        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex-shrink-0">
          {adminSection?.label}
        </span>
        <div className="flex items-center gap-0.5">
          {adminItems.map(item => {
            const Icon = getIcon(item.icon);
            const active = isActive(item);
            return (
              <button
                key={item.key}
                data-tour={`nav-${item.key}`}
                onClick={() => handleItemClick(item)}
                title={item.label}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-red-600 text-white dark:bg-red-500'
                    : 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    )}
    </>
  );
}

/**
 * Barre de navigation globale (bandeau bas, desktop uniquement).
 * Affiche les sections de menu issues de useMenuItems, filtrées par mode d'interface.
 * Déconnexion, toggles mode admin/dev et bouton "Retourner à" ont été déplacés dans la
 * row 1 du header (Layout.tsx, 2026-08-31) — ce bandeau ne gère plus que la navigation.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home, Users, FolderKanban, CircleDot, GitBranch, Network, ExternalLink,
  LayoutDashboard, ClipboardList, Activity, Sun,
  Building2, BarChart3, History, AlertTriangle, Settings, FileText,
  MessageSquare, Map as MapIconLucide, Copy, Search,
  type LucideIcon,
} from 'lucide-react';
import { activityApi } from '../lib/api';
import { useMenuItems } from '../hooks/useMenuItems';
import { useInterfaceModeStore, MODE_GLOBAL_EXCLUDED } from '../stores/interfaceMode';
import type { MenuItemConfig } from '@spok/shared';

const NAV_ICONS: Record<string, LucideIcon> = {
  Home, Users, FolderKanban, CircleDot, GitBranch, Network, ExternalLink,
  LayoutDashboard, ClipboardList, Activity, Sun,
  Building2, BarChart3, History, AlertTriangle, Settings, FileText,
  MessageSquare, MapIcon: MapIconLucide, Copy, Search,
};

const getIcon = (name: string): LucideIcon | null => NAV_ICONS[name] || null;

/** Sections qui ont leurs propres vues dans la SpaceToolbar — exclues ici */
const SPACE_SECTIONS = new Set(['basic', 'itemTypes', 'planning', 'exploration']);
/** Clés gérées ailleurs : profil (modale header), déconnexion (row 1 du header) */
const EXCLUDED_KEYS = new Set(['profile', 'logout']);

export function GlobalNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sections } = useMenuItems();
  const { mode: interfaceMode } = useInterfaceModeStore();

  const handleItemClick = (item: MenuItemConfig) => {
    if (item.route) navigate(item.route);
  };

  const { data: activityData } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.feed(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const activityCount = activityData?.total ?? 0;

  const navSections = sections.filter(s => !SPACE_SECTIONS.has(s.id) && s.id !== 'admin');

  const isActive = (item: MenuItemConfig): boolean => {
    if (!item.route) return false;
    if (item.route === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.route);
  };

  return (
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
                    onClick={() => handleItemClick(item)}
                    title={item.label}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : section.id === 'admin'
                          ? 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
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
  );
}

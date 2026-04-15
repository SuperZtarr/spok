import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  List, GitBranch, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Calendar,
  Network, FileText, CircleDot, Waypoints, Circle, Orbit, SquareStack, TrendingDown,
  Layers, Disc, Table2, Grid3x3, Focus, Flame, Users, LayoutDashboard, Home, Check,
  ChevronDown, Search, User, Shield, LogOut, ExternalLink, Image, Bug, CheckSquare,
  Map as MapIconLucide, Building2, FolderKanban, BarChart3, History, AlertTriangle, Eye, Settings,
} from 'lucide-react';
import { useViewModeStore } from '../stores/viewMode';
import { useMenuItems } from '../hooks/useMenuItems';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { MenuItemConfig } from '@spok/shared';

const ICONS: Record<string, typeof List> = {
  List, GitBranch, FileText, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck,
  Calendar, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, TrendingDown,
  Layers, Disc, Table2, Grid3x3, Focus, Flame, Users, LayoutDashboard, Home,
};
const EXTRA_ICONS: Record<string, typeof List> = {
  Search, User, Shield, LogOut, MapIcon: MapIconLucide, ExternalLink, Image, Bug, CheckSquare,
  Building2, FolderKanban, BarChart3, History, AlertTriangle, Eye, Settings,
};
const getIcon = (name: string) => ICONS[name] || EXTRA_ICONS[name] || List;

interface RenderItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}

interface RenderSection {
  id: string;
  label: string;
  expandable: boolean;
  items: RenderItem[];
}

interface MainMenuProps {
  onOpenProfile: () => void;
  currentSpaceName?: string | null;
  currentCommunityId?: string | null;
  currentCommunityName?: string | null;
}

export function MainMenu({ onOpenProfile, currentCommunityId }: MainMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useViewModeStore();
  const { sections: menuSections } = useMenuItems();
  const { logout, refreshToken } = useAuthStore();

  const isInSpace = /^\/spaces\/[^/]+(\/|$)/.test(location.pathname);

  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const portalRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const closeAll = useCallback(() => { setOpenSection(null); }, []);

  useEffect(() => {
    if (!openSection) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (portalRef.current?.contains(target)) return;
      for (const btn of sectionButtonRefs.current.values()) {
        if (btn.contains(target)) return;
      }
      closeAll();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSection, closeAll]);

  useEffect(() => {
    if (!openSection) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openSection, closeAll]);

  const handleItemClick = (item: MenuItemConfig) => {
    closeAll();
    if (item.key === 'logout') {
      handleLogout();
    } else if (item.key === 'profile') {
      onOpenProfile();
    } else if (item.viewMode) {
      setMode(item.viewMode as any);
    } else if (item.route) {
      navigate(item.route);
    }
  };

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  const isItemActive = (item: MenuItemConfig): boolean => {
    if (item.viewMode) return mode === item.viewMode;
    if (item.route) return location.pathname === item.route;
    return false;
  };

  const SPACE_SECTION_IDS = ['basic', 'itemTypes', 'planning', 'exploration'];

  const allSections: RenderSection[] = menuSections
    .filter(s => {
      if (SPACE_SECTION_IDS.includes(s.id) && !isInSpace) return false;
      return true;
    })
    .map(s => ({
      id: s.id,
      label: s.label,
      expandable: false,
      items: s.items
        .filter(item => {
          // Cacher "Espaces" si aucune communauté active
          if (item.key === 'spaces' && !currentCommunityId) return false;
          return true;
        })
        .map(item => ({
          id: item.key,
          label: item.label,
          icon: item.icon,
          active: isItemActive(item),
          onClick: () => handleItemClick(item),
        })),
    }))
    .filter(s => s.items.length > 0);

  const openSectionDropdown = (sectionId: string) => {
    if (openSection === sectionId) { setOpenSection(null); return; }
    const btn = sectionButtonRefs.current.get(sectionId);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const menuWidth = 220;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setDropdownPos({ top: rect.bottom, left });
    }
    setOpenSection(sectionId);
  };

  const handleSectionMouseEnter = (sectionId: string) => {
    if (openSection && openSection !== sectionId) openSectionDropdown(sectionId);
  };

  const sectionHasActive = (s: RenderSection) => s.items.some(i => i.active);
  const currentSection = allSections.find(s => s.id === openSection);

  // Item dans un dropdown
  const renderDropdownItem = (item: RenderItem) => {
    const Icon = getIcon(item.icon);
    const isDanger = item.id === 'logout';
    return (
      <button
        key={item.id}
        onClick={item.onClick}
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors whitespace-nowrap',
          isDanger
            ? 'text-destructive hover:bg-accent/60'
            : item.active
              ? 'bg-accent text-foreground font-medium'
              : 'text-foreground/80 hover:bg-accent/60'
        )}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', item.active ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1 text-left">{item.label}</span>
        {item.active && <Check className="w-3 h-3 text-primary" />}
      </button>
    );
  };


  // Bouton section avec dropdown — rectangulaire plein hauteur
  const renderSectionTrigger = (s: RenderSection) => (
    <button
      key={s.id}
      ref={el => { if (el) sectionButtonRefs.current.set(s.id, el); }}
      onClick={() => openSectionDropdown(s.id)}
      onMouseEnter={() => handleSectionMouseEnter(s.id)}
      className={cn(
        'self-stretch flex items-center gap-1 px-4 text-sm whitespace-nowrap transition-colors',
        s.id === 'admin'
          ? 'bg-red-100 text-red-700 hover:bg-red-200 font-medium'
          : openSection === s.id || sectionHasActive(s)
            ? 'bg-muted text-foreground font-medium'
            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
      )}
    >
      {s.label}
      <ChevronDown className={cn('w-3 h-3 transition-transform', openSection === s.id && 'rotate-180')} />
    </button>
  );

  return (
    <nav className="ml-auto flex items-stretch h-full overflow-x-auto [&::-webkit-scrollbar]:hidden scroll-smooth" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)' }}>
      {/* Toutes les sections dans l'ordre sectionOrder */}
      {allSections.map(s => renderSectionTrigger(s))}

      {/* Dropdown portal */}
      {openSection && currentSection && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[9999] w-56 max-h-[70vh] overflow-y-auto bg-card border border-border shadow-xl py-1"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {currentSection.items.map(item => renderDropdownItem(item))}
        </div>,
        document.body
      )}
    </nav>
  );
}

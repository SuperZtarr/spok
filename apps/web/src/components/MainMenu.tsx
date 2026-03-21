import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  List, GitBranch, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Calendar,
  Network, FileText, CircleDot, Waypoints, Circle, Orbit, SquareStack, TrendingDown,
  Layers, Disc, Table2, Grid3x3, Focus, Flame, Users, LayoutDashboard, Home, Check,
  Menu as MenuIcon, ChevronDown, Search, User, Shield, LogOut, ExternalLink, Image, Bug,
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
  Search, User, Shield, LogOut, MapIcon: MapIconLucide, ExternalLink, Image, Bug,
  Building2, FolderKanban, BarChart3, History, AlertTriangle, Eye, Settings,
};
const getIcon = (name: string) => ICONS[name] || EXTRA_ICONS[name] || List;

const SECTION_BG: Record<string, string> = {
  admin: 'bg-red-100/60 dark:bg-red-950/30',
  basic: 'bg-blue-100/60 dark:bg-blue-950/30',
  itemTypes: 'bg-blue-100/60 dark:bg-blue-950/30',
  planning: 'bg-blue-100/60 dark:bg-blue-950/30',
  exploration: 'bg-blue-100/60 dark:bg-blue-950/30',
  misc: 'bg-gray-100/60 dark:bg-gray-900/30',
};

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

type LayoutMode = 'hamburger' | 'dropdowns' | 'expanded';

interface MainMenuProps {
  onOpenProfile: () => void;
  currentSpaceName?: string | null;
}

export function MainMenu({ onOpenProfile, currentSpaceName }: MainMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useViewModeStore();
  const { sections: menuSections } = useMenuItems();
  const { user, logout, refreshToken } = useAuthStore();

  const isInSpace = /^\/spaces\/[^/]+(\/|$)/.test(location.pathname);

  // State
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('expanded');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const sectionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const portalRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const closeAll = useCallback(() => { setMobileOpen(false); setOpenSection(null); }, []);

  useEffect(() => {
    if (!mobileOpen && !openSection) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (mobileRef.current?.contains(target) || mobileButtonRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      for (const btn of sectionButtonRefs.current.values()) {
        if (btn.contains(target)) return;
      }
      closeAll();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen, openSection, closeAll]);

  useEffect(() => {
    if (!mobileOpen && !openSection) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, openSection, closeAll]);

  const measureTextWidth = useCallback((text: string, font = '12px ui-sans-serif, system-ui, sans-serif') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.length * 7;
    ctx.font = font;
    return ctx.measureText(text).width;
  }, []);

  // Handle menu item click
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

  // Is item active?
  const isItemActive = (item: MenuItemConfig): boolean => {
    if (item.viewMode) return mode === item.viewMode;
    if (item.route) return location.pathname === item.route;
    return false;
  };

  // Build render sections from menu data
  const SPACE_SECTION_IDS = ['basic', 'itemTypes', 'planning', 'exploration'];

  const allSections: RenderSection[] = menuSections
    .filter(s => {
      if (SPACE_SECTION_IDS.includes(s.id) && !isInSpace) return false;
      return true;
    })
    .map(s => ({
      id: s.id,
      label: s.label,
      expandable: s.id === 'global',
      items: s.items.map(item => ({
        id: item.key,
        label: item.label,
        icon: item.icon,
        active: isItemActive(item),
        onClick: () => handleItemClick(item),
      })),
    }))
    .filter(s => s.items.length > 0);

  const globalSections = allSections.filter(s => !SPACE_SECTION_IDS.includes(s.id));
  const spaceSections = allSections.filter(s => SPACE_SECTION_IDS.includes(s.id));
  const sections = allSections;

  // Measure and decide layout
  const sectionKey = sections.map(s => `${s.id}:${s.items.map(i => i.label).join(',')}`).join('|');
  useEffect(() => {
    if (sections.length === 0) { setLayoutMode('hamburger'); return; }

    const iconSize = 14;
    const itemGap = 4;
    const itemPadX = 16;
    const chevronSize = 12;
    const dropdownPadX = 20;
    const sectionGap = 8;

    const globalSection = sections.find(s => s.id === 'global');
    const expandedGlobalWidth = globalSection
      ? globalSection.items.reduce((w, item) => w + measureTextWidth(item.label) + iconSize + itemPadX + itemGap, 0)
      : 0;

    const otherDropdownsWidth = sections
      .filter(s => s.id !== 'global')
      .reduce((w, s) => {
        const label = s.items.find(i => i.active)?.label || s.label;
        return w + measureTextWidth(label) + iconSize + chevronSize + dropdownPadX + sectionGap;
      }, 0);

    const expandedTotalWidth = expandedGlobalWidth + otherDropdownsWidth;

    const allDropdownsTotalWidth = sections.reduce((w, s) => {
      const label = s.items.find(i => i.active)?.label || s.label;
      return w + measureTextWidth(label) + iconSize + chevronSize + dropdownPadX + sectionGap;
    }, 0);

    const measure = () => {
      const sidebar = document.querySelector('aside');
      const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
      const reservedForOthers = user ? 420 : 250;
      const available = window.innerWidth - sidebarWidth - reservedForOthers;

      if (available >= expandedTotalWidth) {
        setLayoutMode('expanded');
      } else if (available >= allDropdownsTotalWidth) {
        setLayoutMode('dropdowns');
      } else {
        setLayoutMode('hamburger');
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sectionKey, measureTextWidth, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSectionDropdown = (sectionId: string) => {
    if (openSection === sectionId) { setOpenSection(null); return; }
    const btn = sectionButtonRefs.current.get(sectionId);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const menuWidth = 200;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setDropdownPos({ top: rect.bottom + 4, left });
    }
    setOpenSection(sectionId);
  };

  const handleSectionMouseEnter = (sectionId: string) => {
    if (openSection && openSection !== sectionId) openSectionDropdown(sectionId);
  };

  const sectionHasActive = (s: RenderSection) => s.items.some(i => i.active);

  const renderItem = (item: RenderItem, compact = false) => {
    const Icon = getIcon(item.icon);
    const isDanger = item.id === 'logout';
    return (
      <button
        key={item.id}
        onClick={item.onClick}
        className={cn(
          compact
            ? 'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors whitespace-nowrap'
            : 'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
          isDanger ? 'text-destructive hover:bg-accent/50' :
          item.active ? 'bg-accent text-foreground' : 'hover:bg-accent/50 text-foreground/80'
        )}
      >
        <Icon className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4', isDanger ? '' : item.active ? 'text-primary' : 'text-muted-foreground')} />
        <span className={compact ? '' : 'flex-1 text-left'}>{item.label}</span>
        {!compact && item.active && <Check className="w-3 h-3 text-primary ml-auto" />}
      </button>
    );
  };

  const renderSectionDropdown = (s: RenderSection) => (
    <div key={s.id}>
      <button
        ref={el => { if (el) sectionButtonRefs.current.set(s.id, el); }}
        onClick={() => openSectionDropdown(s.id)}
        onMouseEnter={() => handleSectionMouseEnter(s.id)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
          SECTION_BG[s.id],
          openSection === s.id ? 'bg-accent text-foreground' :
          sectionHasActive(s) ? 'text-primary' : 'text-foreground/70 hover:bg-accent/50'
        )}
      >
        {s.label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', openSection === s.id && 'rotate-180')} />
      </button>
    </div>
  );

  const renderSectionExpanded = (s: RenderSection) => (
    <div key={s.id} className="flex items-center gap-0.5">
      <div className="flex items-center gap-0.5">
        {s.items.map(item => renderItem(item, true))}
      </div>
    </div>
  );

  const currentSection = sections.find(s => s.id === openSection);

  return (
    <div ref={containerRef} className="flex items-center">
      {layoutMode === 'hamburger' && (
        <button
          ref={mobileButtonRef}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
          <ChevronDown className={cn('w-3 h-3 transition-transform', mobileOpen && 'rotate-180')} />
        </button>
      )}

      {layoutMode === 'dropdowns' && (
        <nav className="flex items-center gap-1">
          {globalSections.map(s => renderSectionDropdown(s))}
          {spaceSections.length > 0 && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                onClick={() => { closeAll(); setMode('overview' as any); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 whitespace-nowrap"
              >
                {currentSpaceName || 'Espace'}
              </button>
              {spaceSections.map(s => renderSectionDropdown(s))}
            </>
          )}
        </nav>
      )}

      {layoutMode === 'expanded' && (
        <nav className="flex items-center gap-2">
          {globalSections.map(s => s.expandable ? renderSectionExpanded(s) : renderSectionDropdown(s))}
          {spaceSections.length > 0 && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                onClick={() => { closeAll(); setMode('overview' as any); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 whitespace-nowrap"
              >
                {currentSpaceName || 'Espace'}
              </button>
              {spaceSections.map(s => renderSectionDropdown(s))}
            </>
          )}
        </nav>
      )}

      {mobileOpen && createPortal(
        <div
          ref={mobileRef}
          className="fixed inset-0 z-[9999]"
          onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}
        >
          <div className="absolute top-12 left-2 right-2 max-h-[80vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl py-1 sm:left-auto sm:right-4 sm:w-72">
            {globalSections.map((s, i) => (
              <div key={s.id} className={`${i > 0 ? 'border-t border-border' : ''} ${SECTION_BG[s.id] || ''}`}>
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                {s.items.map(item => renderItem(item))}
              </div>
            ))}
            {spaceSections.length > 0 && (
              <>
                <div className="border-t-2 border-blue-300 dark:border-blue-800" />
                <div className="bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5">
                  <button
                    onClick={() => { closeAll(); setMode('overview' as any); }}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider"
                  >
                    {currentSpaceName || 'Espace'}
                  </button>
                </div>
              </>
            )}
            {spaceSections.map((s) => (
              <div key={s.id} className={`border-t border-border ${SECTION_BG[s.id] || ''}`}>
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                {s.items.map(item => renderItem(item))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {openSection && currentSection && createPortal(
        <div
          ref={portalRef}
          className={`fixed z-[9999] w-52 max-h-[70vh] overflow-y-auto border border-border rounded-lg shadow-xl py-1 ${SECTION_BG[openSection] || 'bg-card'}`}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {currentSection.items.map(item => renderItem(item))}
        </div>,
        document.body
      )}
    </div>
  );
}

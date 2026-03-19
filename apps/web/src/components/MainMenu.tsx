import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  List, GitBranch, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Calendar,
  Network, FileText, CircleDot, Waypoints, Circle, Orbit, SquareStack, TrendingDown,
  Layers, Disc, Table2, Grid3x3, Focus, Flame, Users, LayoutDashboard, Home, Check,
  Menu as MenuIcon, ChevronDown, Search, User, Shield, LogOut,
  Map as MapIconLucide, Building2, FolderKanban, BarChart3, History, AlertTriangle, Eye, Settings,
} from 'lucide-react';
import { useViewModeStore } from '../stores/viewMode';
import { useViewConfig } from '../hooks/useViewConfig';
import { useGlobalPages } from '../hooks/useGlobalPages';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../lib/api';
import { cn } from '../lib/utils';

const ICONS: Record<string, typeof List> = {
  List, GitBranch, FileText, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck,
  Calendar, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, TrendingDown,
  Layers, Disc, Table2, Grid3x3, Focus, Flame, Users, LayoutDashboard, Home,
};
const EXTRA_ICONS: Record<string, typeof List> = {
  Search, User, Shield, LogOut, MapIcon: MapIconLucide,
  Building2, FolderKanban, BarChart3, History, AlertTriangle, Eye, Settings,
};
const getIcon = (name: string) => ICONS[name] || EXTRA_ICONS[name] || List;

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}

interface MenuSection {
  id: string;
  label: string;
  expandable: boolean; // true = can be shown inline when there's room (only "global")
  items: MenuItem[];
}

// Layout modes based on available width
type LayoutMode = 'hamburger' | 'dropdowns' | 'expanded';

interface MainMenuProps {
  onOpenProfile: () => void;
}

export function MainMenu({ onOpenProfile }: MainMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useViewModeStore();
  const { views: configViews, categories: configCategories } = useViewConfig();
  const { pages: globalPagesConfig, groups: globalPageGroups } = useGlobalPages();
  const { user, logout, refreshToken } = useAuthStore();

  const isInSpace = /^\/spaces\/[^/]+\//.test(location.pathname);

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

  // Close on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen && !openSection) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, openSection, closeAll]);

  // Measure real text widths using a hidden canvas
  const measureTextWidth = useCallback((text: string, font = '12px ui-sans-serif, system-ui, sans-serif') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.length * 7;
    ctx.font = font;
    return ctx.measureText(text).width;
  }, []);

  // Layout measurement moved after sections declaration below

  // Global tab → route mapping
  const globalTabRoutes: Record<string, string> = {
    home: '/',
    communities: '/communities',
    spaces: '/spaces',
    dashboard: '/dashboard',
    graph: '/graph',
    sunburst: '/sunburst',
    mindmap: '/mindmap',
  };

  const handleViewMode = (modeValue: string) => {
    setMode(modeValue as any);
    closeAll();
  };

  const handleLogout = async () => {
    closeAll();
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    closeAll();
    navigate(path);
  };

  // Build sections
  const globalGroupLabel = globalPageGroups.find(g => g.id === 'global')?.label || 'Vues globales';
  // Filter global tabs by access level
  const globalTabs = globalPagesConfig.filter(p => {
    if (p.group !== 'global') return false;
    if (!user && p.access !== 'public') return false;
    return true;
  });
  const spaceCategories = configCategories.filter(c => c.id !== 'dashboard');
  const viewModes = configViews.map(v => ({ value: v.id, label: v.label, icon: v.icon, category: v.category }));

  const sections: MenuSection[] = [
    {
      id: 'global',
      label: globalGroupLabel,
      expandable: true,
      items: [
        ...globalTabs.map(t => {
          const route = globalTabRoutes[t.id] || '/';
          return {
            id: t.id, label: t.label, icon: t.icon,
            active: location.pathname === route,
            onClick: () => handleNavigate(route),
          };
        }),
        ...(user ? [{ id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', active: location.pathname === '/dashboard', onClick: () => handleNavigate('/dashboard') }] : []),
      ],
    },
    ...(isInSpace ? spaceCategories.map(cat => ({
      id: cat.id,
      label: cat.label,
      expandable: false,
      items: viewModes.filter(v => v.category === cat.id).map(v => ({
        id: v.value, label: v.label, icon: v.icon,
        active: mode === v.value,
        onClick: () => handleViewMode(v.value),
      })),
    })).filter(s => s.items.length > 0) : []),
    ...(user?.globalRole === 'ADMIN' ? [{
      id: 'admin',
      label: 'Administration',
      expandable: false,
      items: [
        { id: 'admin-communities', label: 'Communautes', icon: 'Building2', active: location.pathname === '/admin/communities', onClick: () => handleNavigate('/admin/communities') },
        { id: 'admin-spaces', label: 'Espaces', icon: 'FolderKanban', active: location.pathname === '/admin/spaces', onClick: () => handleNavigate('/admin/spaces') },
        { id: 'admin-users', label: 'Utilisateurs', icon: 'Users', active: location.pathname === '/admin/users', onClick: () => handleNavigate('/admin/users') },
        { id: 'admin-stats', label: 'Statistiques', icon: 'BarChart3', active: location.pathname === '/admin/stats', onClick: () => handleNavigate('/admin/stats') },
        { id: 'admin-audit', label: 'Audit', icon: 'History', active: location.pathname === '/admin/audit-logs', onClick: () => handleNavigate('/admin/audit-logs') },
        { id: 'admin-anomalies', label: 'Diagnostics', icon: 'AlertTriangle', active: location.pathname === '/admin/anomalies', onClick: () => handleNavigate('/admin/anomalies') },
        { id: 'admin-views', label: 'Vues', icon: 'Eye', active: location.pathname === '/admin/views', onClick: () => handleNavigate('/admin/views') },
        { id: 'admin-referentiels', label: 'Referentiels', icon: 'Settings', active: location.pathname === '/admin/referentiels', onClick: () => handleNavigate('/admin/referentiels') },
      ],
    }] : []),
    ...(() => {
      const miscTabs = globalPagesConfig.filter(p => p.group === 'misc');
      if (miscTabs.length === 0 && !user) return [];
      const miscGroupLabel = globalPageGroups.find(g => g.id === 'misc')?.label || 'Divers';

      const miscRoutes: Record<string, string> = { search: '/search', sitemap: '/sitemap' };
      const miscHandlers: Record<string, () => void> = {
        search: () => handleNavigate('/search'),
        profile: () => { closeAll(); onOpenProfile(); },
        sitemap: () => handleNavigate('/sitemap'),
        logout: () => handleLogout(),
      };

      const miscItems = miscTabs
        .filter(t => {
          if (!user && t.access !== 'public') return false;
          return true;
        })
        .map(t => ({
          id: t.id,
          label: t.label,
          icon: t.icon,
          active: miscRoutes[t.id] ? location.pathname === miscRoutes[t.id] : false,
          onClick: miscHandlers[t.id] || (() => {}),
        }));

      if (miscItems.length === 0) return [];
      return [{ id: 'personal', label: miscGroupLabel, expandable: false, items: miscItems }];
    })(),
  ];

  // Measure available width and decide layout
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

  // Section dropdown
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

  const sectionHasActive = (s: MenuSection) => s.items.some(i => i.active);

  // Render item
  const renderItem = (item: MenuItem, compact = false) => {
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

  // Render section as dropdown button
  const renderSectionDropdown = (s: MenuSection) => (
    <div key={s.id}>
      <button
        ref={el => { if (el) sectionButtonRefs.current.set(s.id, el); }}
        onClick={() => openSectionDropdown(s.id)}
        onMouseEnter={() => handleSectionMouseEnter(s.id)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
          openSection === s.id ? 'bg-accent text-foreground' :
          sectionHasActive(s) ? 'text-primary' : 'text-foreground/70 hover:bg-accent/50'
        )}
      >
        {s.label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', openSection === s.id && 'rotate-180')} />
      </button>
    </div>
  );

  // Render section expanded inline
  const renderSectionExpanded = (s: MenuSection) => (
    <div key={s.id} className="flex items-center gap-0.5">
      <div className="flex items-center gap-0.5">
        {s.items.map(item => renderItem(item, true))}
      </div>
    </div>
  );

  const currentSection = sections.find(s => s.id === openSection);

  return (
    <div ref={containerRef} className="flex items-center">
      {/* ─── Hamburger mode ─── */}
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

      {/* ─── Dropdowns mode: all sections as dropdown buttons ─── */}
      {layoutMode === 'dropdowns' && (
        <nav className="flex items-end gap-1">
          {sections.map(s => renderSectionDropdown(s))}
        </nav>
      )}

      {/* ─── Expanded mode: global inline, rest as dropdowns ─── */}
      {layoutMode === 'expanded' && (
        <nav className="flex items-end gap-2">
          {sections.map(s => s.expandable ? renderSectionExpanded(s) : renderSectionDropdown(s))}
        </nav>
      )}

      {/* ─── Hamburger dropdown (portal) ─── */}
      {mobileOpen && createPortal(
        <div
          ref={mobileRef}
          className="fixed inset-0 z-[9999]"
          onClick={(e) => { if (e.target === e.currentTarget) closeAll(); }}
        >
          <div className="absolute top-12 left-2 right-2 max-h-[80vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl py-1 sm:left-auto sm:right-4 sm:w-72">
            {sections.map((s, i) => (
              <div key={s.id} className={i > 0 ? 'border-t border-border' : ''}>
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                {s.items.map(item => renderItem(item))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* ─── Section dropdown (portal, shared by dropdowns + expanded modes) ─── */}
      {openSection && currentSection && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[9999] w-52 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-lg shadow-xl py-1"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {currentSection.items.map(item => renderItem(item))}
        </div>,
        document.body
      )}
    </div>
  );
}

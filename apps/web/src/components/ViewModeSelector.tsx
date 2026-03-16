import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List, GitBranch, Columns3, Share2, LayoutGrid,
  GanttChart, CalendarCheck, Calendar, Network, FileText, CircleDot, Waypoints, PenTool, Circle, Orbit, SquareStack, TrendingDown, Layers, Disc, Table2, Grid3x3, Focus, Check,
  ChevronDown, FolderKanban, CheckSquare, LayoutDashboard, ClipboardList, Flame, Gauge, Home,
  Eye, Users,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useViewModeStore, VIEW_MODES, VIEW_CATEGORIES, type ViewCategory } from '../stores/viewMode';
import { useDashboardTabStore, DASHBOARD_TABS } from '../stores/dashboardTab';
import { cn } from '../lib/utils';
import { VIEW_TOURS, DASHBOARD_TOURS } from '../hooks/viewTours';

const VIEW_TOUR_PREFIX = 'spok-view-tour-done-';
const DASH_TOUR_PREFIX = 'spok-dashboard-tour-done-';

function hasUnseenViewTour(mode: string): boolean {
  return !!(VIEW_TOURS as Record<string, unknown>)[mode] && !localStorage.getItem(VIEW_TOUR_PREFIX + mode);
}

function hasUnseenDashTour(tab: string): boolean {
  return !!(DASHBOARD_TOURS as Record<string, unknown>)[tab] && !localStorage.getItem(DASH_TOUR_PREFIX + tab);
}

const UnseenDot = () => (
  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
);

const ICONS: Record<string, typeof List> = {
  List,
  GitBranch,
  FileText,
  Columns3,
  Share2,
  LayoutGrid,
  GanttChart,
  CalendarCheck,
  Calendar,
  Network,
  CircleDot,
  Waypoints,
  PenTool,
  Circle,
  Orbit,
  SquareStack,
  TrendingDown,
  Layers,
  Disc,
  FolderKanban,
  CheckSquare,
  Table2,
  Grid3x3,
  Focus,
  Users,
  LayoutDashboard,
  Flame,
  Gauge,
  Home,
};

export function ViewModeSelector() {
  const { mode, setMode } = useViewModeStore();
  const { tab, setTab } = useDashboardTabStore();
  const navigate = useNavigate();
  const location = useLocation();

  type MenuCategory = ViewCategory | 'myActivities';

  // Dropdown states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<MenuCategory | null>(null);

  // Refs
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRefs = useRef<Map<MenuCategory, HTMLButtonElement>>(new Map());

  // Positions
  const [mobilePos, setMobilePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [categoryDropdownPos, setCategoryDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isDashboard = location.pathname === '/';
  const isInSpace = /^\/spaces\/[^/]+/.test(location.pathname);

  // Dashboard tab groups
  const globalTabs = DASHBOARD_TABS.filter(t => t.group === 'global');
  const myActivitiesTabs = DASHBOARD_TABS.filter(t => t.group === 'myActivities');

  // Categories visible in space (for md dropdown level)
  const spaceCategories = VIEW_CATEGORIES.filter(cat => cat.value !== 'dashboard');

  // --- Position helpers ---
  const computeDropdownPos = useCallback((btn: HTMLElement | null, dropdownWidth: number) => {
    if (!btn) return { top: 0, left: 0 };
    const rect = btn.getBoundingClientRect();
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    return { top: rect.bottom, left };
  }, []);

  const updateMobilePosition = useCallback(() => {
    setMobilePos(computeDropdownPos(mobileButtonRef.current, 220));
  }, [computeDropdownPos]);

  const updateCategoryDropdownPos = useCallback((cat: MenuCategory) => {
    setCategoryDropdownPos(computeDropdownPos(categoryButtonRefs.current.get(cat) || null, 200));
  }, [computeDropdownPos]);

  // --- Close all dropdowns helper ---
  const closeAll = useCallback(() => {
    setMobileMenuOpen(false);
    setOpenCategory(null);
  }, []);

  // --- Category dropdown handlers ---
  const handleCategoryClick = useCallback((cat: MenuCategory) => {
    if (openCategory === cat) {
      setOpenCategory(null);
    } else {
      updateCategoryDropdownPos(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updateCategoryDropdownPos]);

  const handleCategoryMouseEnter = useCallback((cat: MenuCategory) => {
    if (openCategory && openCategory !== cat) {
      updateCategoryDropdownPos(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updateCategoryDropdownPos]);

  // --- Close on click outside ---
  useEffect(() => {
    if (!mobileMenuOpen && !openCategory) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        mobileButtonRef.current?.contains(e.target as Node) ||
        navRef.current?.contains(e.target as Node)
      ) return;
      closeAll();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen, openCategory, closeAll]);

  // --- Close on Escape ---
  useEffect(() => {
    if (!mobileMenuOpen && !openCategory) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen, openCategory, closeAll]);

  // --- Is a category active? ---
  const isCategoryActive = (catValue: ViewCategory): boolean => {
    if (catValue === 'dashboard') return isDashboard;
    return VIEW_MODES.some(v => v.category === catValue && v.value === mode);
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  // --- Mobile menu content (unified dropdown) ---
  const renderMobileMenuContent = () => {
    if (!isInSpace) {
      // Dashboard: show grouped tabs
      return (
        <>
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vues globales</div>
          {globalTabs.map(dashTab => {
            const Icon = ICONS[dashTab.icon];
            const isActive = isDashboard && tab === dashTab.value;
            return (
              <button
                key={dashTab.value}
                onClick={() => { setTab(dashTab.value); closeAll(); if (!isDashboard) navigate('/'); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 text-left">{dashTab.label}</span>
                {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
              </button>
            );
          })}
          <div className="h-px bg-border mx-1 my-1" />
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Mes activités</div>
          {myActivitiesTabs.map(dashTab => {
            const Icon = ICONS[dashTab.icon];
            const isActive = isDashboard && tab === dashTab.value;
            return (
              <button
                key={dashTab.value}
                onClick={() => { setTab(dashTab.value); closeAll(); if (!isDashboard) navigate('/'); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1 text-left">{dashTab.label}</span>
                {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
              </button>
            );
          })}
        </>
      );
    }

    // Space: vues globales + mes activités + all view modes grouped by category
    return (
      <>
        <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vues globales</div>
        {globalTabs.map(dashTab => {
          const Icon = ICONS[dashTab.icon];
          const isActive = isDashboard && tab === dashTab.value;
          return (
            <button
              key={dashTab.value}
              onClick={() => { setTab(dashTab.value); closeAll(); navigate('/'); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="flex-1 text-left">{dashTab.label}</span>
              {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
            </button>
          );
        })}
        <div className="h-px bg-border mx-1 my-1" />
        {VIEW_CATEGORIES.filter(c => c.value !== 'dashboard').map((cat, catIdx) => {
          const catModes = VIEW_MODES.filter(v => v.category === cat.value);
          return (
            <div key={cat.value}>
              {catIdx > 0 && <div className="h-px bg-border mx-1 my-1" />}
              <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{cat.label}</div>
              {catModes.map(viewMode => {
                const Icon = ICONS[viewMode.icon];
                const isActive = mode === viewMode.value;
                return (
                  <button
                    key={viewMode.value}
                    onClick={() => { setMode(viewMode.value); closeAll(); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="flex-1 text-left">{viewMode.label}</span>
                    {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenViewTour(viewMode.value) && <UnseenDot />}
                  </button>
                );
              })}
            </div>
          );
        })}
        <div className="h-px bg-border mx-1 my-1" />
        <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Mes activités</div>
        {myActivitiesTabs.map(dashTab => {
          const Icon = ICONS[dashTab.icon];
          const isActive = isDashboard && tab === dashTab.value;
          return (
            <button
              key={dashTab.value}
              onClick={() => { setTab(dashTab.value); closeAll(); navigate('/'); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="flex-1 text-left">{dashTab.label}</span>
              {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
            </button>
          );
        })}
      </>
    );
  };

  // --- Dashboard inline items: icon + optional text ---
  const renderDashboardInline = (showLabels: boolean) => (
    <div className="flex items-center gap-0.5">
      {globalTabs.map(dashTab => {
        const Icon = ICONS[dashTab.icon];
        const isActive = isDashboard && tab === dashTab.value;
        return (
          <button
            key={dashTab.value}
            onClick={() => { setTab(dashTab.value); if (!isDashboard) navigate('/'); }}
            title={dashTab.label}
            className={cn(
              'flex items-center gap-1.5 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
              isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
            {showLabels && <span>{dashTab.label}</span>}
          </button>
        );
      })}
      <div className="w-px h-5 bg-border mx-1" />
      {myActivitiesTabs.map(dashTab => {
        const Icon = ICONS[dashTab.icon];
        const isActive = isDashboard && tab === dashTab.value;
        return (
          <button
            key={dashTab.value}
            onClick={() => { setTab(dashTab.value); if (!isDashboard) navigate('/'); }}
            title={dashTab.label}
            className={cn(
              'flex items-center gap-1.5 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
              isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
            {showLabels && <span>{dashTab.label}</span>}
          </button>
        );
      })}
    </div>
  );

  // --- Dashboard dropdown content (global views only) ---
  const renderDashboardDropdownContent = () => (
    <>
      {globalTabs.map(dashTab => {
        const Icon = ICONS[dashTab.icon];
        const isActive = isDashboard && tab === dashTab.value;
        return (
          <button
            key={dashTab.value}
            onClick={() => { setTab(dashTab.value); closeAll(); navigate('/'); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
              isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
            <span className="flex-1 text-left">{dashTab.label}</span>
            {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
          </button>
        );
      })}
    </>
  );

  // --- My Activities dropdown content ---
  const renderMyActivitiesDropdownContent = () => (
    <>
      {myActivitiesTabs.map(dashTab => {
        const Icon = ICONS[dashTab.icon];
        const isActive = isDashboard && tab === dashTab.value;
        return (
          <button
            key={dashTab.value}
            onClick={() => { setTab(dashTab.value); closeAll(); navigate('/'); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
              isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
            <span className="flex-1 text-left">{dashTab.label}</span>
            {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenDashTour(dashTab.value) && <UnseenDot />}
          </button>
        );
      })}
    </>
  );

  // --- Category dropdown content (for md level) ---
  const renderCategoryDropdownContent = () => {
    if (!openCategory) return null;

    if (openCategory === 'dashboard') {
      return renderDashboardDropdownContent();
    }

    if (openCategory === 'myActivities') {
      return renderMyActivitiesDropdownContent();
    }

    const activeCategoryModes = VIEW_MODES.filter(v => v.category === openCategory);
    return (
      <>
        {activeCategoryModes.map(viewMode => {
          const Icon = ICONS[viewMode.icon];
          const isActive = mode === viewMode.value;
          return (
            <button
              key={viewMode.value}
              onClick={() => { setMode(viewMode.value); closeAll(); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                isActive ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="flex-1 text-left">{viewMode.label}</span>
              {isActive ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : hasUnseenViewTour(viewMode.value) && <UnseenDot />}
            </button>
          );
        })}
      </>
    );
  };

  // --- Space categories with dropdowns (md level) ---
  const renderSpaceCategories = () => (
    <ul className="flex items-center gap-0.5 list-none m-0 p-0">
      {/* Vues globales (ex-Accueil) */}
      <li className="relative">
        <button
          ref={(el) => { if (el) categoryButtonRefs.current.set('dashboard', el); }}
          onClick={() => handleCategoryClick('dashboard')}
          onMouseEnter={() => handleCategoryMouseEnter('dashboard')}
          className={cn(
            'flex items-center gap-1 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
            openCategory === 'dashboard'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span>Vues globales</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', openCategory === 'dashboard' && 'rotate-180')} />
        </button>
      </li>

      {/* Separator */}
      <li><div className="w-px h-5 bg-border mx-0.5" /></li>

      {/* Space view categories */}
      {spaceCategories.map((cat) => {
        const isActive = isCategoryActive(cat.value);
        const isOpen = openCategory === cat.value;
        return (
          <li key={cat.value} className="relative">
            <button
              ref={(el) => { if (el) categoryButtonRefs.current.set(cat.value, el); }}
              onClick={() => handleCategoryClick(cat.value)}
              onMouseEnter={() => handleCategoryMouseEnter(cat.value)}
              className={cn(
                'flex items-center gap-1 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
                isOpen
                  ? 'text-foreground border-primary'
                  : isActive
                    ? 'text-foreground/90 border-primary/50'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
              )}
            >
              {cat.label}
              <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', isOpen && 'rotate-180')} />
            </button>
          </li>
        );
      })}

      {/* Separator */}
      <li><div className="w-px h-5 bg-border mx-0.5" /></li>

      {/* Mes activités */}
      <li className="relative">
        <button
          ref={(el) => { if (el) categoryButtonRefs.current.set('myActivities', el); }}
          onClick={() => handleCategoryClick('myActivities')}
          onMouseEnter={() => handleCategoryMouseEnter('myActivities')}
          className={cn(
            'flex items-center gap-1 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
            openCategory === 'myActivities'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
          )}
        >
          <ClipboardList className="w-4 h-4 flex-shrink-0" />
          <span>Mes activités</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', openCategory === 'myActivities' && 'rotate-180')} />
        </button>
      </li>
    </ul>
  );

  // =============================================
  // MAIN RENDER
  // =============================================
  return (
    <>
      {/* ===== Mobile (<lg): compact menu button ===== */}
      <div className="lg:hidden">
        <button
          ref={mobileButtonRef}
          onClick={() => {
            if (mobileMenuOpen) { setMobileMenuOpen(false); }
            else { updateMobilePosition(); setMobileMenuOpen(true); }
          }}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors',
            mobileMenuOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          {isInSpace ? <Eye className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', mobileMenuOpen && 'rotate-180')} />
        </button>
      </div>

      {/* ===== Desktop nav (lg+) ===== */}
      <nav ref={navRef} className="hidden lg:flex items-center">
        {!isInSpace ? (
          <>
            {/* lg: icons only */}
            <div className="flex xl:hidden">{renderDashboardInline(false)}</div>
            {/* xl+: icons + labels */}
            <div className="hidden xl:flex">{renderDashboardInline(true)}</div>
          </>
        ) : (
          renderSpaceCategories()
        )}
      </nav>

      {/* ===== Category dropdown portal (md space view) ===== */}
      {openCategory && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 border border-border bg-card rounded-md shadow-md py-1 w-[200px]"
          style={{ top: categoryDropdownPos.top + 2, left: categoryDropdownPos.left }}
        >
          {renderCategoryDropdownContent()}
        </div>,
        document.body
      )}

      {/* ===== Mobile dropdown portal ===== */}
      {mobileMenuOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 border border-border bg-card rounded-md shadow-md py-1 w-[220px] max-h-[70vh] overflow-y-auto"
          style={{ top: mobilePos.top + 2, left: mobilePos.left }}
        >
          {renderMobileMenuContent()}
        </div>,
        document.body
      )}
    </>
  );
}

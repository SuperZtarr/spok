import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid,
  GanttChart, CalendarCheck, Calendar, Network, FileText, CircleDot, Waypoints, PenTool, Check,
  ChevronDown, FolderKanban, CheckSquare, ExternalLink, LayoutDashboard,
  Eye,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useViewModeStore, VIEW_MODES, VIEW_CATEGORIES, type ViewCategory } from '../stores/viewMode';
import { useDashboardTabStore, DASHBOARD_TABS, DASHBOARD_NAV_ITEMS } from '../stores/dashboardTab';
import { cn } from '../lib/utils';

const ICONS: Record<string, typeof List> = {
  List,
  GitBranch,
  FileText,
  ArrowDownUp,
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
  FolderKanban,
  CheckSquare,
};

export function ViewModeSelector() {
  const { mode, setMode } = useViewModeStore();
  const { tab, setTab } = useDashboardTabStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Dropdown states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<ViewCategory | null>(null);

  // Refs
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRefs = useRef<Map<ViewCategory, HTMLButtonElement>>(new Map());

  // Positions
  const [mobilePos, setMobilePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [dashboardDropdownPos, setDashboardDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [categoryDropdownPos, setCategoryDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isDashboard = location.pathname === '/';
  const isInSpace = /^\/spaces\/[^/]+/.test(location.pathname);

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

  const updateDashboardDropdownPos = useCallback(() => {
    setDashboardDropdownPos(computeDropdownPos(dashboardButtonRef.current, 200));
  }, [computeDropdownPos]);

  const updateCategoryDropdownPos = useCallback((cat: ViewCategory) => {
    setCategoryDropdownPos(computeDropdownPos(categoryButtonRefs.current.get(cat) || null, 200));
  }, [computeDropdownPos]);

  // --- Close all dropdowns helper ---
  const closeAll = useCallback(() => {
    setMobileMenuOpen(false);
    setDashboardDropdownOpen(false);
    setOpenCategory(null);
  }, []);

  // --- Category dropdown handlers ---
  const handleCategoryClick = useCallback((cat: ViewCategory) => {
    if (openCategory === cat) {
      setOpenCategory(null);
    } else {
      updateCategoryDropdownPos(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updateCategoryDropdownPos]);

  const handleCategoryMouseEnter = useCallback((cat: ViewCategory) => {
    if (openCategory && openCategory !== cat) {
      updateCategoryDropdownPos(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updateCategoryDropdownPos]);

  // --- Close on click outside ---
  useEffect(() => {
    if (!mobileMenuOpen && !dashboardDropdownOpen && !openCategory) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        mobileButtonRef.current?.contains(e.target as Node) ||
        dashboardButtonRef.current?.contains(e.target as Node) ||
        navRef.current?.contains(e.target as Node)
      ) return;
      closeAll();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen, dashboardDropdownOpen, openCategory, closeAll]);

  // --- Close on Escape ---
  useEffect(() => {
    if (!mobileMenuOpen && !dashboardDropdownOpen && !openCategory) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen, dashboardDropdownOpen, openCategory, closeAll]);

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
      return (
        <>
          {DASHBOARD_TABS.map(dashTab => {
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
                {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
          {DASHBOARD_NAV_ITEMS.length > 0 && <div className="h-px bg-border mx-1 my-1" />}
          {DASHBOARD_NAV_ITEMS.map(navItem => {
            const Icon = ICONS[navItem.icon];
            return (
              <button
                key={navItem.route}
                onClick={() => { navigate(navItem.route); closeAll(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-foreground/80 hover:bg-accent hover:text-foreground"
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{navItem.label}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
              </button>
            );
          })}
        </>
      );
    }

    // Space: dashboard link + all view modes grouped by category
    return (
      <>
        <button
          onClick={() => { navigate('/'); closeAll(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-foreground/80 hover:bg-accent hover:text-foreground"
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">Tableau de bord</span>
        </button>
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
                    {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  // --- Dashboard inline items: icon + optional text ---
  const renderDashboardInline = (showLabels: boolean) => (
    <div className="flex items-center gap-0.5">
      {DASHBOARD_TABS.map(dashTab => {
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
      {DASHBOARD_NAV_ITEMS.map(navItem => {
        const Icon = ICONS[navItem.icon];
        const isActive = location.pathname === navItem.route;
        return (
          <button
            key={navItem.route}
            onClick={() => navigate(navItem.route)}
            title={navItem.label}
            className={cn(
              'flex items-center gap-1.5 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
              isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
            {showLabels && <span>{navItem.label}</span>}
          </button>
        );
      })}
    </div>
  );

  // --- Dashboard dropdown content (used in space views) ---
  const renderDashboardDropdownContent = () => (
    <>
      {DASHBOARD_TABS.map(dashTab => {
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
            {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </button>
        );
      })}
      {DASHBOARD_NAV_ITEMS.length > 0 && <div className="h-px bg-border mx-1 my-1" />}
      {DASHBOARD_NAV_ITEMS.map(navItem => {
        const Icon = ICONS[navItem.icon];
        return (
          <button
            key={navItem.route}
            onClick={() => { navigate(navItem.route); closeAll(); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left">{navItem.label}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
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
              {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          );
        })}
      </>
    );
  };

  // --- Space categories with dropdowns (md level) ---
  const renderSpaceCategories = () => (
    <ul className="flex items-center gap-0.5 list-none m-0 p-0">
      {/* Dashboard category */}
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
          <span>Accueil</span>
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
    </ul>
  );

  // --- Space views inline: dashboard dropdown + view modes grouped by category ---
  const renderSpaceViewsInline = (showLabels: boolean) => (
    <div className="flex items-end gap-2">
      {/* Dashboard dropdown button */}
      <div className="flex flex-col items-center">
        <button
          ref={dashboardButtonRef}
          onClick={() => {
            if (dashboardDropdownOpen) {
              setDashboardDropdownOpen(false);
            } else {
              updateDashboardDropdownPos();
              setDashboardDropdownOpen(true);
            }
          }}
          title="Tableau de bord"
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 text-sm transition-colors whitespace-nowrap rounded-md',
            dashboardDropdownOpen
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          {showLabels && <span>Accueil</span>}
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', dashboardDropdownOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-border self-center" />

      {/* View modes grouped by category */}
      {spaceCategories.map((cat, idx) => {
        const catModes = VIEW_MODES.filter(v => v.category === cat.value);
        const isCatActive = isCategoryActive(cat.value);
        return (
          <div key={cat.value} className="flex items-end gap-2">
            {idx > 0 && <div className="w-px h-8 bg-border self-center" />}
            <div className={cn(
              'flex flex-col items-center rounded-lg px-1.5 py-1 transition-colors',
              isCatActive ? 'bg-accent/50' : '',
            )}>
              <span className="text-[10px] font-medium text-muted-foreground/60 leading-none mb-1 uppercase tracking-wider">{cat.label}</span>
              <div className="flex items-center gap-0.5">
                {catModes.map(viewMode => {
                  const Icon = ICONS[viewMode.icon];
                  const isActive = mode === viewMode.value;
                  return (
                    <button
                      key={viewMode.value}
                      onClick={() => setMode(viewMode.value)}
                      title={viewMode.label}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 text-sm transition-colors whitespace-nowrap rounded-md',
                        isActive
                          ? 'bg-primary/10 text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
                      {showLabels && <span>{viewMode.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // =============================================
  // MAIN RENDER
  // =============================================
  return (
    <>
      {/* ===== Mobile (<md): compact menu button ===== */}
      <div className="md:hidden">
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

      {/* ===== Desktop nav (md+) ===== */}
      <nav ref={navRef} className="hidden md:flex items-center">
        {!isInSpace ? (
          <>
            {/* md: icons only */}
            <div className="flex lg:hidden">{renderDashboardInline(false)}</div>
            {/* lg+: icons + labels */}
            <div className="hidden lg:flex">{renderDashboardInline(true)}</div>
          </>
        ) : (
          <>
            {/* md: category dropdowns */}
            <div className="flex lg:hidden">{renderSpaceCategories()}</div>
            {/* lg: inline icons only */}
            <div className="hidden lg:flex xl:hidden">{renderSpaceViewsInline(false)}</div>
            {/* xl+: inline icons + labels */}
            <div className="hidden xl:flex">{renderSpaceViewsInline(true)}</div>
          </>
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

      {/* ===== Dashboard dropdown portal (lg+ space view) ===== */}
      {dashboardDropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 border border-border bg-card rounded-md shadow-md py-1 w-[200px]"
          style={{ top: dashboardDropdownPos.top + 2, left: dashboardDropdownPos.left }}
        >
          {renderDashboardDropdownContent()}
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

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Check, ChevronDown, FolderKanban, LayoutDashboard, ClipboardList, Eye,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { getViewIcon } from '../constants/viewIcons';
import { useViewModeStore, type ViewCategory } from '../stores/viewMode';
import { useViewConfig } from '../hooks/useViewConfig';
import { useGlobalPages } from '../hooks/useGlobalPages';
import { useDashboardTabStore } from '../stores/dashboardTab';
import type { DashboardTab } from '../stores/dashboardTab';
import { cn } from '../lib/utils';
import { VIEW_TOURS } from '../hooks/viewTours';

const VIEW_TOUR_PREFIX = 'spok-view-tour-done-';

function hasUnseenViewTour(mode: string): boolean {
  return !!(VIEW_TOURS as Record<string, unknown>)[mode] && !localStorage.getItem(VIEW_TOUR_PREFIX + mode);
}

function hasUnseenDashTour(_tab: string): boolean {
  return false;
}

const UnseenDot = () => (
  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
);


export function ViewModeSelector() {
  const { mode, setMode, allowedViews } = useViewModeStore();
  const { tab, setTab } = useDashboardTabStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { views: configViews, categories: configCategories } = useViewConfig();
  const { pages: globalPagesConfig, groups: globalPageGroups } = useGlobalPages();

  // Map config to VIEW_MODES-compatible format, filtered by allowedViews for VIEWER role
  const allViewModes = configViews.map(v => ({ value: v.id as any, label: v.label, icon: v.icon, category: v.category }));
  const VIEW_MODES = allowedViews ? allViewModes.filter(v => allowedViews.includes(v.value)) : allViewModes;

  const allCategories = configCategories.map(c => ({ value: c.id, label: c.label }));
  const VIEW_CATEGORIES = allowedViews
    ? allCategories.filter(c => c.value === 'dashboard' || VIEW_MODES.some(v => v.category === c.value))
    : allCategories;

  // Build dashboard tabs from config
  const globalTabs = globalPagesConfig.filter(p => p.group === 'global').map(p => ({ value: p.id as DashboardTab, label: p.label, icon: p.icon, group: p.group }));
  const myActivitiesTabs = globalPagesConfig.filter(p => p.group === 'myActivities').map(p => ({ value: p.id as DashboardTab, label: p.label, icon: p.icon, group: p.group }));
  const globalGroupLabel = globalPageGroups.find(g => g.id === 'global')?.label || 'Vues globales';
  const myActivitiesGroupLabel = globalPageGroups.find(g => g.id === 'myActivities')?.label || 'Mes activités';

  type MenuCategory = ViewCategory | 'myActivities' | 'espaces';

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
    const width = cat === 'espaces' ? 640 : 200;
    setCategoryDropdownPos(computeDropdownPos(categoryButtonRefs.current.get(cat) || null, width));
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
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{globalGroupLabel}</div>
          {globalTabs.map(dashTab => {
            const Icon = getViewIcon(dashTab.icon);
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
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{myActivitiesGroupLabel}</div>
          {myActivitiesTabs.map(dashTab => {
            const Icon = getViewIcon(dashTab.icon);
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
        <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{globalGroupLabel}</div>
        {globalTabs.map(dashTab => {
          const Icon = getViewIcon(dashTab.icon);
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
                const Icon = getViewIcon(viewMode.icon);
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
        <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{myActivitiesGroupLabel}</div>
        {myActivitiesTabs.map(dashTab => {
          const Icon = getViewIcon(dashTab.icon);
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
        const Icon = getViewIcon(dashTab.icon);
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
        const Icon = getViewIcon(dashTab.icon);
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
        const Icon = getViewIcon(dashTab.icon);
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
        const Icon = getViewIcon(dashTab.icon);
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

  // --- Espaces multi-column dropdown ---
  const renderEspacesDropdownContent = () => {
    const spaceId = location.pathname.match(/\/spaces\/([^/]+)/)?.[1];
    return (
      <div className="p-3">
        {spaceId && (
          <>
            <button
              onClick={() => { navigate(`/spaces/${spaceId}`); closeAll(); }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm transition-colors rounded-md text-foreground/80 hover:bg-accent hover:text-foreground"
            >
              <FolderKanban className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span>Présentation</span>
            </button>
            <div className="h-px bg-border my-2" />
          </>
        )}
        <div className="flex gap-1">
          {spaceCategories.map((cat) => {
            const catModes = VIEW_MODES.filter(v => v.category === cat.value);
            return (
              <div key={cat.value} className="min-w-[140px]">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{cat.label}</div>
                {catModes.map(viewMode => {
                  const Icon = getViewIcon(viewMode.icon);
                  const isActive = mode === viewMode.value;
                  return (
                    <button
                      key={viewMode.value}
                      onClick={() => { setMode(viewMode.value); closeAll(); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 text-sm transition-colors rounded-md',
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
        </div>
      </div>
    );
  };

  // --- Category dropdown content (for md level) ---
  const renderCategoryDropdownContent = () => {
    if (!openCategory) return null;

    if (openCategory === 'espaces') {
      return renderEspacesDropdownContent();
    }

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
          const Icon = getViewIcon(viewMode.icon);
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
          <span>{globalGroupLabel}</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', openCategory === 'dashboard' && 'rotate-180')} />
        </button>
      </li>

      {/* Separator */}
      <li><div className="w-px h-5 bg-border mx-0.5" /></li>

      {/* Single Espaces button */}
      <li className="relative">
        <button
          ref={(el) => { if (el) categoryButtonRefs.current.set('espaces', el); }}
          onClick={() => handleCategoryClick('espaces')}
          onMouseEnter={() => handleCategoryMouseEnter('espaces')}
          className={cn(
            'flex items-center gap-1 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
            openCategory === 'espaces'
              ? 'text-foreground border-primary'
              : spaceCategories.some(c => isCategoryActive(c.value))
                ? 'text-foreground/90 border-primary/50'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
          )}
        >
          <FolderKanban className="w-4 h-4 flex-shrink-0" />
          <span>Espaces</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', openCategory === 'espaces' && 'rotate-180')} />
        </button>
      </li>

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
          <span>{myActivitiesGroupLabel}</span>
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
          className={cn(
            'fixed z-50 border border-border bg-card rounded-md shadow-md',
            openCategory === 'espaces' ? 'w-auto' : 'w-[200px] py-1'
          )}
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

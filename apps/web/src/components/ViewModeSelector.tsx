import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid,
  GanttChart, CalendarCheck, Network, FileText, CircleDot, Check,
  ChevronDown, FolderKanban, CheckSquare, ExternalLink, LayoutDashboard,
  Eye,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useViewModeStore, VIEW_MODES, VIEW_CATEGORIES } from '../stores/viewMode';
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
  Network,
  CircleDot,
  FolderKanban,
  CheckSquare,
};

export function ViewModeSelector() {
  const { mode, setMode } = useViewModeStore();
  const { tab, setTab } = useDashboardTabStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [dashboardDropdownPos, setDashboardDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isDashboard = location.pathname === '/';
  const isInSpace = /^\/spaces\/[^/]+/.test(location.pathname);

  const updateMobilePosition = useCallback(() => {
    const btn = mobileButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 220;
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    setPosition({ top: rect.bottom, left });
  }, []);

  const updateDashboardDropdownPos = useCallback(() => {
    const btn = dashboardButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 200;
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    setDashboardDropdownPos({ top: rect.bottom, left });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!mobileMenuOpen && !dashboardDropdownOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        mobileButtonRef.current?.contains(e.target as Node) ||
        dashboardButtonRef.current?.contains(e.target as Node)
      ) return;
      setMobileMenuOpen(false);
      setDashboardDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen, dashboardDropdownOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileMenuOpen && !dashboardDropdownOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setDashboardDropdownOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileMenuOpen, dashboardDropdownOpen]);

  // --- Mobile menu content (unified dropdown) ---
  const renderMobileMenuContent = () => {
    if (!isInSpace) {
      // Dashboard: show all tabs + nav items
      return (
        <>
          {DASHBOARD_TABS.map(dashTab => {
            const Icon = ICONS[dashTab.icon];
            const isActive = isDashboard && tab === dashTab.value;
            return (
              <button
                key={dashTab.value}
                onClick={() => {
                  setTab(dashTab.value);
                  setMobileMenuOpen(false);
                  if (!isDashboard) navigate('/');
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span className="flex-1 text-left">{dashTab.label}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
          {DASHBOARD_NAV_ITEMS.length > 0 && (
            <div className="h-px bg-border mx-1 my-1" />
          )}
          {DASHBOARD_NAV_ITEMS.map(navItem => {
            const Icon = ICONS[navItem.icon];
            return (
              <button
                key={navItem.route}
                onClick={() => {
                  navigate(navItem.route);
                  setMobileMenuOpen(false);
                }}
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

    // Space: show all view modes grouped by category + dashboard link
    return (
      <>
        {/* Dashboard link */}
        <button
          onClick={() => {
            navigate('/');
            setMobileMenuOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-foreground/80 hover:bg-accent hover:text-foreground"
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">Tableau de bord</span>
        </button>
        <div className="h-px bg-border mx-1 my-1" />

        {/* View modes by category */}
        {VIEW_CATEGORIES.filter(c => c.value !== 'dashboard').map((cat, catIdx) => {
          const catModes = VIEW_MODES.filter(v => v.category === cat.value);
          return (
            <div key={cat.value}>
              {catIdx > 0 && <div className="h-px bg-border mx-1 my-1" />}
              <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {cat.label}
              </div>
              {catModes.map(viewMode => {
                const Icon = ICONS[viewMode.icon];
                const isActive = mode === viewMode.value;
                return (
                  <button
                    key={viewMode.value}
                    onClick={() => {
                      setMode(viewMode.value);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className={cn(
                      'w-4 h-4 flex-shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )} />
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

  // --- Dashboard inline items: icon + optional text buttons ---
  const renderDashboardInline = (showLabels: boolean) => {
    return (
      <div className="flex items-center gap-0.5">
        {DASHBOARD_TABS.map(dashTab => {
          const Icon = ICONS[dashTab.icon];
          const isActive = isDashboard && tab === dashTab.value;
          return (
            <button
              key={dashTab.value}
              onClick={() => {
                setTab(dashTab.value);
                if (!isDashboard) navigate('/');
              }}
              title={dashTab.label}
              className={cn(
                'flex items-center gap-1.5 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
                isActive
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
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
                isActive
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
              {showLabels && <span>{navItem.label}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  // --- Dashboard dropdown content (used in space view) ---
  const renderDashboardDropdownContent = () => {
    return (
      <>
        {DASHBOARD_TABS.map(dashTab => {
          const Icon = ICONS[dashTab.icon];
          const isActive = isDashboard && tab === dashTab.value;
          return (
            <button
              key={dashTab.value}
              onClick={() => {
                setTab(dashTab.value);
                setDashboardDropdownOpen(false);
                navigate('/');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/80 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className="flex-1 text-left">{dashTab.label}</span>
              {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          );
        })}
        {DASHBOARD_NAV_ITEMS.length > 0 && (
          <div className="h-px bg-border mx-1 my-1" />
        )}
        {DASHBOARD_NAV_ITEMS.map(navItem => {
          const Icon = ICONS[navItem.icon];
          return (
            <button
              key={navItem.route}
              onClick={() => {
                navigate(navItem.route);
                setDashboardDropdownOpen(false);
              }}
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
  };

  // --- Space views inline: dashboard dropdown + all view modes as direct buttons ---
  const renderSpaceViewsInline = (showLabels: boolean) => {
    return (
      <div className="flex items-center gap-0.5">
        {/* Dashboard dropdown button */}
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
            'flex items-center gap-1 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
            dashboardDropdownOpen
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          {showLabels && <span>Accueil</span>}
          <ChevronDown className={cn(
            'w-3 h-3 transition-transform duration-150',
            dashboardDropdownOpen && 'rotate-180'
          )} />
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* All view modes */}
        {VIEW_MODES.map(viewMode => {
          const Icon = ICONS[viewMode.icon];
          const isActive = mode === viewMode.value;
          return (
            <button
              key={viewMode.value}
              onClick={() => setMode(viewMode.value)}
              title={viewMode.label}
              className={cn(
                'flex items-center gap-1.5 px-2 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
                isActive
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
              {showLabels && <span>{viewMode.label}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* ===== Mobile (<md): compact menu button ===== */}
      <div className="md:hidden">
        <button
          ref={mobileButtonRef}
          onClick={() => {
            if (mobileMenuOpen) {
              setMobileMenuOpen(false);
            } else {
              updateMobilePosition();
              setMobileMenuOpen(true);
            }
          }}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors',
            mobileMenuOpen
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          {isInSpace ? (
            <Eye className="w-4 h-4" />
          ) : (
            <LayoutDashboard className="w-4 h-4" />
          )}
          <ChevronDown className={cn(
            'w-3 h-3 transition-transform duration-150',
            mobileMenuOpen && 'rotate-180'
          )} />
        </button>
      </div>

      {/* ===== Desktop nav (md+) ===== */}
      <nav ref={navRef} className="hidden md:flex items-center">
        {!isInSpace ? (
          <>
            {/* Tablet: icons only */}
            <div className="flex lg:hidden">{renderDashboardInline(false)}</div>
            {/* Desktop large: icons + labels */}
            <div className="hidden lg:flex">{renderDashboardInline(true)}</div>
          </>
        ) : (
          <>
            {/* Tablet: icons only */}
            <div className="flex lg:hidden">{renderSpaceViewsInline(false)}</div>
            {/* Desktop large: icons + labels */}
            <div className="hidden lg:flex">{renderSpaceViewsInline(true)}</div>
          </>
        )}
      </nav>

      {/* ===== Dashboard dropdown portal (space view, md+) ===== */}
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
          style={{ top: position.top + 2, left: position.left }}
        >
          {renderMobileMenuContent()}
        </div>,
        document.body
      )}
    </>
  );
}

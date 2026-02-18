import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid,
  GanttChart, CalendarCheck, Network, FileText, CircleDot, Check,
  ChevronDown, FolderKanban, CheckSquare, ExternalLink,
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
  const [openCategory, setOpenCategory] = useState<ViewCategory | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRefs = useRef<Map<ViewCategory, HTMLButtonElement>>(new Map());

  const isDashboard = location.pathname === '/';

  const updatePosition = useCallback((cat: ViewCategory) => {
    const btn = buttonRefs.current.get(cat);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 200;
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    setPosition({ top: rect.bottom, left });
  }, []);

  const handleClick = useCallback((cat: ViewCategory) => {
    if (openCategory === cat) {
      setOpenCategory(null);
    } else {
      updatePosition(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updatePosition]);

  // Hover to switch between categories when one is already open
  const handleMouseEnter = useCallback((cat: ViewCategory) => {
    if (openCategory && openCategory !== cat) {
      updatePosition(cat);
      setOpenCategory(cat);
    }
  }, [openCategory, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!openCategory) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        navRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpenCategory(null);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openCategory]);

  // Close on Escape
  useEffect(() => {
    if (!openCategory) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenCategory(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [openCategory]);

  // Check if a category is active
  const isCategoryActive = (catValue: ViewCategory): boolean => {
    if (catValue === 'dashboard') return isDashboard;
    return VIEW_MODES.some(v => v.category === catValue && v.value === mode);
  };

  // Render dropdown content based on category
  const renderDropdownContent = () => {
    if (!openCategory) return null;

    if (openCategory === 'dashboard') {
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
                  setOpenCategory(null);
                  if (!isDashboard) navigate('/');
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
                  setOpenCategory(null);
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
    }

    // Space categories
    const activeCategoryModes = VIEW_MODES.filter(v => v.category === openCategory);
    // Get current space ID from URL
    const spaceMatch = location.pathname.match(/\/spaces\/([^/]+)/);
    const currentSpaceId = spaceMatch ? spaceMatch[1] : null;

    return (
      <>
        {activeCategoryModes.map(viewMode => {
          const Icon = ICONS[viewMode.icon];
          const isActive = mode === viewMode.value;
          return (
            <button
              key={viewMode.value}
              onClick={() => {
                setMode(viewMode.value);
                setOpenCategory(null);
                // If not currently in a space, stay on current page — view mode will apply when entering a space
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
              <span className="flex-1 text-left">{viewMode.label}</span>
              {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          );
        })}
      </>
    );
  };

  return (
    <>
      <nav ref={navRef} className="flex items-center">
        <ul className="flex items-center gap-0.5 list-none m-0 p-0">
          {VIEW_CATEGORIES.map((cat) => {
            const isActive = isCategoryActive(cat.value);
            const isOpen = openCategory === cat.value;
            return (
              <li key={cat.value} className="relative">
                <button
                  ref={(el) => { if (el) buttonRefs.current.set(cat.value, el); }}
                  onClick={() => handleClick(cat.value)}
                  onMouseEnter={() => handleMouseEnter(cat.value)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-2 text-sm transition-colors whitespace-nowrap border-b-2',
                    isOpen
                      ? 'text-foreground border-primary'
                      : isActive
                        ? 'text-foreground/90 border-primary/50'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border',
                  )}
                >
                  {cat.label}
                  <ChevronDown className={cn(
                    'w-3 h-3 transition-transform duration-150',
                    isOpen && 'rotate-180'
                  )} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {openCategory && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 border border-border bg-card rounded-md shadow-md py-1 w-[200px]"
          style={{ top: position.top + 2, left: position.left }}
        >
          {renderDropdownContent()}
        </div>,
        document.body
      )}
    </>
  );
}

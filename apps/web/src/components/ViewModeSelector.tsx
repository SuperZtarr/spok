import { useState, useRef, useEffect, useCallback } from 'react';
import { List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Network, FileText, CircleDot, Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useViewModeStore, VIEW_MODES, VIEW_CATEGORIES, type ViewCategory } from '../stores/viewMode';
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
};

export function ViewModeSelector() {
  const { mode, setMode } = useViewModeStore();
  const [openCategory, setOpenCategory] = useState<ViewCategory | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRefs = useRef<Map<ViewCategory, HTMLButtonElement>>(new Map());

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

  const activeCategoryModes = openCategory
    ? VIEW_MODES.filter(v => v.category === openCategory)
    : [];

  return (
    <>
      <nav ref={navRef} className="flex items-center bg-muted/50 rounded-lg p-0.5">
        {VIEW_CATEGORIES.map((cat) => {
          const isActive = VIEW_MODES.some(v => v.category === cat.value && v.value === mode);
          const isOpen = openCategory === cat.value;
          return (
            <button
              key={cat.value}
              ref={(el) => { if (el) buttonRefs.current.set(cat.value, el); }}
              onClick={() => handleClick(cat.value)}
              onMouseEnter={() => handleMouseEnter(cat.value)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-[13px] rounded-md transition-all duration-150',
                isOpen
                  ? 'bg-background text-foreground shadow-sm'
                  : isActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
              )}
            >
              {cat.label}
              <ChevronDown className={cn(
                'w-3 h-3 transition-transform duration-150',
                isOpen && 'rotate-180'
              )} />
            </button>
          );
        })}
      </nav>

      {openCategory && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 border border-border rounded-lg shadow-lg py-1 w-[200px]"
          style={{ top: position.top + 4, left: position.left, backgroundColor: 'hsl(var(--card))' }}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {VIEW_CATEGORIES.find(c => c.value === openCategory)?.label}
          </div>
          <div className="h-px bg-border mx-2 mb-1" />
          {activeCategoryModes.map(viewMode => {
            const Icon = ICONS[viewMode.icon];
            const isActive = mode === viewMode.value;
            return (
              <button
                key={viewMode.value}
                onClick={() => {
                  setMode(viewMode.value);
                  setOpenCategory(null);
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
        </div>,
        document.body
      )}
    </>
  );
}

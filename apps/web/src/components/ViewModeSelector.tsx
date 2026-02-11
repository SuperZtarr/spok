import { useState, useRef, useEffect, useCallback } from 'react';
import { List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Network, FileText, CircleDot, ChevronLeft, ChevronRight } from 'lucide-react';
import { useViewModeStore, VIEW_MODES } from '../stores/viewMode';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    setCanScrollLeft(el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'right' ? 120 : -120, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-0.5 min-w-0">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground"
          title="Vues précédentes"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex items-center gap-0.5 bg-muted rounded-lg p-1 overflow-x-auto min-w-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {VIEW_MODES.map((viewMode) => {
          const Icon = ICONS[viewMode.icon];
          const isActive = mode === viewMode.value;

          return (
            <button
              key={viewMode.value}
              onClick={() => setMode(viewMode.value)}
              className={cn(
                'flex items-center gap-1.5 px-1.5 md:px-2 py-1.5 rounded-md text-sm font-medium transition-colors flex-shrink-0',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title={viewMode.label}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden xl:inline">{viewMode.label}</span>
            </button>
          );
        })}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground"
          title="Vues suivantes"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

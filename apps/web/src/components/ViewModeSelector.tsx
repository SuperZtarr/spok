import { List, GitBranch, ArrowDownUp, Columns3, Share2, LayoutGrid, GanttChart, CalendarCheck, Network, FileText } from 'lucide-react';
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
};

export function ViewModeSelector() {
  const { mode, setMode } = useViewModeStore();

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {VIEW_MODES.map((viewMode) => {
        const Icon = ICONS[viewMode.icon];
        const isActive = mode === viewMode.value;

        return (
          <button
            key={viewMode.value}
            onClick={() => setMode(viewMode.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={viewMode.label}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{viewMode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

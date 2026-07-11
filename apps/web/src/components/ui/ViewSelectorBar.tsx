/* Barre de sélection de vue (boutons par section) utilisée par SpaceToolbar. */
import {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock,
  type LucideIcon,
} from 'lucide-react';
import type { ViewMode } from '../../stores/viewMode';
import type { MenuItemConfig } from '@spok/shared';

const MOBILE_HIDDEN_VIEWS = new Set([
  'kanban', 'types', 'members',
  'timeline', 'planning', 'graph', 'sunburst', 'relations',
  'bubble', 'radialTree', 'treemap', 'burndown', 'cfd', 'chord',
  'crossTable', 'heatmap', 'ego',
]);

const VIEW_ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock,
};

export interface ViewSelectorBarProps {
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
  allowedViews: ViewMode[] | null;
  spaceViews: MenuItemConfig[];
  defaultView?: ViewMode;
}

export function ViewSelectorBar({ viewMode, onSetMode, allowedViews, spaceViews, defaultView }: ViewSelectorBarProps) {
  const filteredViews = spaceViews.filter(
    (v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode))
  );
  const sectionMap = new Map<string, { sectionOrder: number; views: typeof filteredViews }>();
  for (const v of filteredViews) {
    if (!sectionMap.has(v.section)) {
      sectionMap.set(v.section, { sectionOrder: v.sectionOrder, views: [] });
    }
    sectionMap.get(v.section)!.views.push(v);
  }
  const sections = [...sectionMap.values()].sort((a, b) => a.sectionOrder - b.sectionOrder);
  if (sections.length === 0) return null;

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-0.5 scrollbar-none px-4 pt-1">
      {sections.map((section, idx) => (
        <div key={idx} className="flex flex-col gap-0.5 flex-shrink-0">
          <span className="hidden sm:block text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            {section.views[0]?.sectionLabel}
          </span>
          <div className="flex items-center gap-0.5">
            {section.views.map((v) => {
              const Icon = VIEW_ICON_MAP[v.icon];
              const isActive = viewMode === v.viewMode;
              const isDefault = defaultView && v.viewMode === defaultView;
              const showPulse = isDefault && !isActive;
              return (
                <button
                  key={v.key}
                  onClick={() => onSetMode(v.viewMode as ViewMode)}
                  title={isDefault ? `${v.label} (vue par défaut)` : v.label}
                  className={`relative inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  } ${v.viewMode && MOBILE_HIDDEN_VIEWS.has(v.viewMode) ? 'hidden sm:inline-flex' : ''}`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="hidden sm:inline">{v.label}</span>
                  {showPulse && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

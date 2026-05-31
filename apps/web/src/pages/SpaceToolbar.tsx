import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  X,
  Settings,
  History,
  ListChecks,
  SlidersHorizontal,
  Plus,
  List,
  GitBranch,
  Columns3,
  FileText,
  CalendarCheck,
  GanttChart,
  Calendar,
  LayoutGrid,
  Share2,
  Network,
  CircleDot,
  Waypoints,
  Circle,
  Orbit,
  SquareStack,
  Disc,
  TrendingDown,
  Layers,
  Users,
  Flame,
  Table2,
  Grid3x3,
  Focus,
  ExternalLink,
  Image,
  Bug,
  CheckSquare,
  MessageSquare,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { ItemType } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';
import { ViewHelpButton } from '../components/ViewHelpButton';
import { CollapseToggleButton } from '../components/ui/CollapseToggleButton';
import { SpaceExportButton } from '../components/SpaceExportButton';
import type { ViewMode } from '../stores/viewMode';
import type { MenuItemConfig, Item } from '@spok/shared';

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

export interface SpaceToolbarProps {
  // Filters
  filter: ItemType | 'ALL';
  onFilterChange: (filter: ItemType | 'ALL') => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  isHighlightMode: boolean;
  // Search
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  // Counts
  totalItemCount: number;
  filteredItemCount: number;
  searchMatchCount?: number;
  // Referentiels
  referentiels?: any;
  // View mode
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
  allowedViews: ViewMode[] | null;
  spaceViews: MenuItemConfig[];
  defaultView?: ViewMode;
  // Expand/Collapse
  isExpanded: boolean;
  onToggleExpand: () => void;
  // Actions
  canEdit: boolean;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onNewItem: () => void;
  // Space
  spaceId?: string;
  spaceRole?: string;
  // Export
  items?: Item[];
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function SpaceToolbar({
  filter,
  onFilterChange,
  statusFilter,
  onStatusFilterChange,
  isHighlightMode,
  searchQuery,
  onSearchQueryChange,
  totalItemCount,
  filteredItemCount,
  searchMatchCount,
  referentiels,
  viewMode,
  onSetMode,
  allowedViews,
  spaceViews,
  defaultView,
  isExpanded,
  onToggleExpand,
  canEdit,
  isSelectionMode,
  onToggleSelectionMode,
  onNewItem,
  spaceId,
  spaceRole,
  items: exportItems,
  spaceName,
  viewContainerRef,
  onStartTour,
  pulseHelp,
}: SpaceToolbarProps) {
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const activeTypeFilter = filter !== 'ALL' ? filter : undefined;
  const activeStatusFilter = statusFilter !== 'ALL' ? statusFilter : undefined;

  // Close filter dropdowns on click outside or Escape
  useEffect(() => {
    if (!typeDropdownOpen && !statusDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTypeDropdownOpen(false); setStatusDropdownOpen(false); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [typeDropdownOpen, statusDropdownOpen]);

  const showExpandCollapse = viewMode === 'tree';

  return (
    <div className="flex flex-col gap-2 mb-3 z-20 bg-background pb-2 flex-shrink-0 relative">

      {/* View mode buttons row — filtered by admin menu config + role */}
      {(() => {
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
          <div className="flex items-start gap-3 overflow-x-auto pb-0.5 scrollbar-none">
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
      })()}

      <div className="flex gap-1.5 flex-wrap items-center pb-1">
        {/* Mode indicator + filters — always visible on sm+, toggle on mobile */}
        <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex gap-1.5 items-center flex-wrap`}>
        {isHighlightMode ? (
          <span className="inline-flex items-center justify-center gap-1 h-8 rounded-md px-3 text-xs font-medium border border-yellow-300 bg-yellow-50 text-yellow-700 shadow-sm flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="hidden sm:inline">Lumière</span>
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-1 h-8 rounded-md px-3 text-xs font-medium border border-blue-300 bg-blue-50 text-blue-700 shadow-sm flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="hidden sm:inline">Filtre</span>
          </span>
        )}

        {/* Type filter dropdown */}
        <div ref={typeDropdownRef} className="relative flex-shrink-0" data-tour="toolbar-filters">
          <button
            onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); }}
            className={`inline-flex items-center gap-1.5 h-8 rounded-md px-3 text-xs font-medium transition-all whitespace-nowrap border ${
              activeTypeFilter
                ? `border-2 ${getTypeColor(activeTypeFilter, referentiels?.typeLabels).color} ${getTypeColor(activeTypeFilter, referentiels?.typeLabels).bgHover} font-semibold shadow-sm`
                : 'border-input bg-background shadow-sm hover:bg-accent text-muted-foreground'
            }`}
          >
            {activeTypeFilter ? TYPE_LABELS[activeTypeFilter] : 'Types'}
            <ChevronDown className={`w-3 h-3 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {typeDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[160px]">
              {(['ALL', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const).map((t) => {
                const isActive = filter === t;
                const typeColor = t !== 'ALL' ? getTypeColor(t, referentiels?.typeLabels) : null;
                return (
                  <button
                    key={t}
                    onClick={() => { onFilterChange(t); setTypeDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {typeColor && <span className={`w-2 h-2 rounded-full ${typeColor.bgHover}`} />}
                    <span className="flex-1 text-left">{t === 'ALL' ? 'Tous les types' : TYPE_LABELS[t]}</span>
                    {isActive && t !== 'ALL' && <span className="text-primary text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status filter dropdown */}
        <div ref={statusDropdownRef} className="relative flex-shrink-0">
          {(() => {
            const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
            const activeStatus = activeStatusFilter ? statuses.find((s: any) => s.id === activeStatusFilter) : null;
            const visibleStatuses = statuses.filter((s: any) => s.visible);
            return (
              <>
                <button
                  onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); }}
                  className={`inline-flex items-center gap-1.5 h-8 rounded-md px-3 text-xs font-medium transition-all whitespace-nowrap border ${
                    activeStatus
                      ? `border-2 ${activeStatus.borderColor} font-semibold shadow-sm`
                      : 'border-input bg-background shadow-sm hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {activeStatus ? activeStatus.label : 'Statuts'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[180px]">
                    <button
                      onClick={() => { onStatusFilterChange('ALL'); setStatusDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                        statusFilter === 'ALL' ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <span className="flex-1 text-left">Tous les statuts</span>
                    </button>
                    {visibleStatuses.map((s: any) => {
                      const isActive = statusFilter === s.id;
                      const dotColor = s.borderColor.split(' ')[1] || s.borderColor.split(' ')[0];
                      return (
                        <button
                          key={s.id}
                          onClick={() => { onStatusFilterChange(s.id); setStatusDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                            isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="flex-1 text-left">{s.label}</span>
                          {isActive && <span className="text-primary text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        </div>{/* end mobile filters wrapper */}

        {/* Search input */}
        <div className="relative flex-shrink-0" data-tour="toolbar-search">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="h-8 w-40 pl-8 pr-7 text-xs border border-input rounded-md bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Item count */}
        <span className="inline-flex items-center justify-center h-8 rounded-md px-3 text-xs font-medium border border-input bg-background shadow-sm text-muted-foreground whitespace-nowrap flex-shrink-0">
          {(() => {
            const hasFilter = filter !== 'ALL' || statusFilter !== 'ALL';
            const hasSearch = searchQuery.trim().length > 0;
            if (hasSearch) {
              return `${searchMatchCount ?? 0}/${totalItemCount} éléments`;
            }
            if (hasFilter && !isHighlightMode) {
              return `${filteredItemCount}/${totalItemCount} éléments`;
            }
            return `${totalItemCount} éléments`;
          })()}
        </span>

        <ViewHelpButton viewMode={viewMode} onStartTour={onStartTour} pulse={pulseHelp} />

        {showExpandCollapse && (
          <>
            <div className="h-6 w-px bg-border mx-1 flex-shrink-0" />
            <CollapseToggleButton
              isCollapsed={!isExpanded}
              onToggle={onToggleExpand}
              className="flex-shrink-0"
            />
          </>
        )}


        <div className="ml-auto flex gap-1 flex-shrink-0">
          {/* Mobile filter toggle */}
          <button
            className={`sm:hidden relative inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors flex-shrink-0 ${
              showMobileFilters
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setShowMobileFilters(v => !v)}
            title="Filtres"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(activeTypeFilter || activeStatusFilter) && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
          {exportItems && spaceName && viewMode !== 'mindmap' && viewMode !== 'pert' && viewMode !== 'timeline' && (
            <SpaceExportButton items={exportItems} spaceName={spaceName} viewMode={viewMode} viewContainerRef={viewContainerRef} />
          )}
          {canEdit && (
            <Link to={`/spaces/${spaceId}/history`}>
              <Button variant="ghost" size="sm" title="Historique des modifications">
                <History className="w-4 h-4" />
              </Button>
            </Link>
          )}
          {spaceRole === 'OWNER' && (
            <Link to={`/spaces/${spaceId}/settings`}>
              <Button variant="ghost" size="sm" title="Paramètres de l'espace">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          )}
          {canEdit && (
            <Button
              variant={isSelectionMode ? 'default' : 'ghost'}
              size="sm"
              onClick={onToggleSelectionMode}
              title={isSelectionMode ? 'Quitter le mode sélection' : 'Mode sélection'}
            >
              <ListChecks className="w-4 h-4" />
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={onNewItem} data-tour="toolbar-new-item">
              <Plus className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Nouveau</span>
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  X,
  ChevronsUpDown,
  ChevronsDownUp,
  RotateCcw,
  Settings,
  History,
  ListChecks,
  Plus,
} from 'lucide-react';
import type { ItemType } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';

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
  viewMode: string;
  // Expand/Collapse
  isExpanded: boolean;
  onToggleExpand: () => void;
  // MindMap reset
  onResetLayout: () => void;
  // Actions
  canEdit: boolean;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onNewItem: () => void;
  // Space
  spaceId?: string;
  spaceRole?: string;
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
  isExpanded,
  onToggleExpand,
  onResetLayout,
  canEdit,
  isSelectionMode,
  onToggleSelectionMode,
  onNewItem,
  spaceId,
  spaceRole,
}: SpaceToolbarProps) {
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
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

  const showExpandCollapse = viewMode === 'tree' || viewMode === 'mindmap';
  const showResetLayout = viewMode === 'mindmap';

  return (
    <div className="flex flex-col gap-2 mb-3 z-10 bg-background pb-2 flex-shrink-0">
      <div className="flex gap-1.5 flex-wrap items-center pb-1">
        {/* Mode indicator */}
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
        <div ref={typeDropdownRef} className="relative flex-shrink-0">
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
              {(['ALL', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG'] as const).map((t) => {
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

        {/* Search input */}
        <div className="relative flex-shrink-0">
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

        {showExpandCollapse && (
          <>
            <div className="h-6 w-px bg-border mx-1 flex-shrink-0" />
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              title={isExpanded ? 'Tout réduire' : 'Tout étendre'}
              className="flex-shrink-0"
            >
              {isExpanded ? (
                <>
                  <ChevronsDownUp className="w-4 h-4 mr-1" />
                  Réduire
                </>
              ) : (
                <>
                  <ChevronsUpDown className="w-4 h-4 mr-1" />
                  Étendre
                </>
              )}
            </Button>
          </>
        )}

        {showResetLayout && (
          <>
            <div className="h-6 w-px bg-border mx-1 flex-shrink-0" />
            <Button
              variant="outline"
              size="sm"
              onClick={onResetLayout}
              title="Réorganiser les éléments"
              className="flex-shrink-0"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Réorganiser
            </Button>
          </>
        )}

        <div className="ml-auto flex gap-1 flex-shrink-0">
          <Link to={`/spaces/${spaceId}/history`}>
            <Button variant="ghost" size="sm" title="Historique des modifications">
              <History className="w-4 h-4" />
            </Button>
          </Link>
          {(spaceRole === 'OWNER' || spaceRole === 'ADMIN') && (
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
            <Button size="sm" onClick={onNewItem}>
              <Plus className="w-4 h-4 mr-1" />
              Nouveau
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

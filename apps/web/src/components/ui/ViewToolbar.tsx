import { Plus, History, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ItemType, Item, SpaceReferentiels } from '@spok/shared';
import { ViewHelpButton } from '../ViewHelpButton';
import { SpaceExportButton } from '../SpaceExportButton';
import { TreeSortButton } from './TreeSortButton';
import { FilterToolbar } from './FilterToolbar';
import { CollapseToggleButton } from './CollapseToggleButton';
import type { ViewMode } from '../../stores/viewMode';
import type { TreeSort } from '../../lib/treeSort';

export interface ViewToolbarProps {
  // Identity
  viewMode: ViewMode;
  spaceId?: string;
  spaceRole?: string;
  // Help
  onStartTour?: () => void;
  pulseHelp?: boolean;
  // New item
  onNewItem?: () => void;
  canEdit?: boolean;
  // Export
  exportItems?: Item[];
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  // Tree sort (optional)
  treeSortValue?: TreeSort;
  onTreeSortChange?: (mode: TreeSort) => void;
  // Expand/collapse (optional)
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // Filter toolbar props
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  totalItemCount?: number;
  filteredItemCount?: number;
  searchMatchCount?: number;
  referentiels?: SpaceReferentiels;
  isHighlightMode?: boolean;
  // Layout
  className?: string;
}

export function ViewToolbar({
  viewMode, spaceId, spaceRole,
  onStartTour, pulseHelp,
  onNewItem, canEdit,
  exportItems, spaceName, viewContainerRef,
  treeSortValue, onTreeSortChange,
  isExpanded, onToggleExpand,
  filter, onFilterChange, statusFilter, onStatusFilterChange,
  searchQuery, onSearchQueryChange,
  totalItemCount, filteredItemCount, searchMatchCount,
  referentiels,
  isHighlightMode = false,
  className = '',
}: ViewToolbarProps) {
  const showExport = !['mindmap', 'pert', 'timeline'].includes(viewMode);

  return (
    <div className={`sticky top-0 z-[1] flex items-center gap-2 px-4 py-1 border-b border-border bg-background flex-shrink-0 ${className}`}>
        <ViewHelpButton viewMode={viewMode} onStartTour={onStartTour} pulse={pulseHelp} />
        {canEdit && onNewItem && (
          <button
            onClick={onNewItem}
            data-tour="toolbar-new-item"
            className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
        {showExport && exportItems && spaceName && viewContainerRef && (
          <SpaceExportButton items={exportItems} spaceName={spaceName} viewMode={viewMode} viewContainerRef={viewContainerRef} />
        )}
        {treeSortValue !== undefined && onTreeSortChange && (
          <TreeSortButton value={treeSortValue} onChange={onTreeSortChange} />
        )}
        {onToggleExpand && (
          <CollapseToggleButton isCollapsed={!isExpanded} onToggle={onToggleExpand} />
        )}

        <div className="h-4 w-px bg-border" />

        <FilterToolbar
          filter={filter}
          onFilterChange={onFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          totalItemCount={totalItemCount}
          filteredItemCount={filteredItemCount}
          searchMatchCount={searchMatchCount}
          referentiels={referentiels}
          isHighlightMode={isHighlightMode}
        />

        {/* Droite : Historique, Paramètres */}
        {canEdit && spaceId && (
          <Link to={`/spaces/${spaceId}/history`}>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Historique">
              <History className="w-4 h-4" />
            </button>
          </Link>
        )}
        {spaceRole === 'OWNER' && spaceId && (
          <Link to={`/spaces/${spaceId}/settings`}>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Paramètres">
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        )}
    </div>
  );
}

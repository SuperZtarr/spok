import { Minus, Plus, ArrowDownAZ, Network, History, Settings, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import { ViewSelectorBar } from '../ui/ViewSelectorBar';
import { ViewHelpButton } from '../ViewHelpButton';
import { FilterToolbar } from '../ui/FilterToolbar';
import type { Item, ItemType, MenuItemConfig, SpaceReferentiels } from '@spok/shared';
import { buildExportFilename, exportDataPDF, exportSvgAsPng, exportSvgAsPdf } from '../../lib/exportUtils';
import { TreeSortButton } from '../ui/TreeSortButton';
import { type TreeSort } from '../../lib/treeSort';
import type { ViewMode } from '../../stores/viewMode';

interface PertToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  hasParents: boolean;
  hasCollapsed: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  items: Item[];
  spaceName: string;
  containerRef: React.RefObject<HTMLDivElement>;
  svgRef: React.RefObject<SVGSVGElement>;
  sortMode: 'rank' | 'alpha';
  onSortModeChange: (mode: 'rank' | 'alpha') => void;
  treeSort: TreeSort;
  onTreeSortChange: (mode: TreeSort) => void;
  spaceViews?: MenuItemConfig[];
  allowedViews?: ViewMode[] | null;
  onSetMode?: (mode: ViewMode) => void;
  defaultView?: ViewMode;
  onNewItem?: () => void;
  canEdit?: boolean;
  showOnlyBlocking?: boolean;
  onToggleBlocking?: () => void;
  spaceId?: string;
  spaceRole?: string;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  totalItemCount?: number;
  referentiels?: SpaceReferentiels;
}

export function PertToolbar({
  zoom, onZoomIn, onZoomOut, onResetZoom,
  hasParents, hasCollapsed, onCollapseAll, onExpandAll,
  items, spaceName, svgRef,
  sortMode, onSortModeChange,
  treeSort, onTreeSortChange,
  spaceViews, allowedViews, onSetMode, defaultView,
  onNewItem, canEdit, spaceId, spaceRole,
  showOnlyBlocking = false, onToggleBlocking,
  onStartTour, pulseHelp,
  filter = 'ALL', onFilterChange, statusFilter = 'ALL', onStatusFilterChange,
  totalItemCount, referentiels,
}: PertToolbarProps) {
  const filename = buildExportFilename(spaceName, 'pert');

  return (
    <div className="sticky top-0 z-10 flex flex-col border-b border-border bg-background backdrop-blur-sm">
      {spaceViews && onSetMode && (
        <ViewSelectorBar viewMode="pert" onSetMode={onSetMode} allowedViews={allowedViews ?? null} spaceViews={spaceViews} defaultView={defaultView} />
      )}
      <div className="flex items-center gap-1 px-2 py-1">
        {/* Standard — gauche */}
        <ViewHelpButton viewMode="pert" onStartTour={onStartTour} pulse={pulseHelp} />
        {canEdit && onNewItem && (
          <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
        {onToggleBlocking && (
          <button
            onClick={onToggleBlocking}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors ${showOnlyBlocking ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            title={showOnlyBlocking ? 'Afficher tous les items' : 'Afficher uniquement les items avec liens bloquants'}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bloquants</span>
          </button>
        )}
        <div className="h-4 w-px bg-border mx-1" />
        {/* PERT-specific */}
        {hasParents && (
          <>
            <CollapseToggleButton
              isCollapsed={hasCollapsed}
              onToggle={hasCollapsed ? onExpandAll : onCollapseAll}
            />
            <div className="h-4 w-px bg-border mx-1" />
          </>
        )}
        <button onClick={onZoomOut} className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground" title="Dézoomer">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={onResetZoom} className="text-xs w-11 text-center tabular-nums text-muted-foreground hover:text-foreground transition-colors" title="Réinitialiser le zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={onZoomIn} className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground" title="Zoomer">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <TreeSortButton value={treeSort} onChange={onTreeSortChange} />
        <div className="h-4 w-px bg-border mx-1" />
        <button onClick={() => onSortModeChange('rank')} className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${sortMode === 'rank' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`} title="Trier par dépendances">
          <Network className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onSortModeChange('alpha')} className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${sortMode === 'alpha' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`} title="Trier alphabétiquement">
          <ArrowDownAZ className="w-3.5 h-3.5" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        {/* Lumière + droite */}
        <FilterToolbar
          filter={filter}
          onFilterChange={onFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          totalItemCount={totalItemCount}
          referentiels={referentiels}
          isHighlightMode={true}
        />
        <ExportDropdownButton
          groups={[
            { options: [{ label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, filename, spaceName) }] },
            { options: [
              { label: 'PNG — vue (.png)', onClick: () => svgRef.current ? exportSvgAsPng(svgRef.current, filename) : Promise.resolve() },
              { label: 'PDF — vue (.pdf)', onClick: () => svgRef.current ? exportSvgAsPdf(svgRef.current, filename) : Promise.resolve() },
            ]},
          ]}
        />
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
    </div>
  );
}

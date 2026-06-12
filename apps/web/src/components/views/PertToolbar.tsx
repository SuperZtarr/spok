import { Minus, Plus, ShieldAlert, ListTree, ArrowDownAZ, Check, Info } from 'lucide-react';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import { ViewSelectorBar } from '../ui/ViewSelectorBar';
import { ViewToolbar } from '../ui/ViewToolbar';
import type { Item, ItemType, MenuItemConfig, SpaceReferentiels } from '@spok/shared';
import { buildExportFilename, exportDataPDF, exportSvgAsPng, exportSvgAsPdf } from '../../lib/exportUtils';
import { type TreeSort } from '../../lib/treeSort';
import type { ViewMode } from '../../stores/viewMode';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const PERT_SORT_OPTIONS: { treeSort: TreeSort; sortMode: 'rank' | 'alpha'; label: string }[] = [
  { treeSort: 'manual',     sortMode: 'rank',  label: 'Position (défaut)' },
  { treeSort: 'alpha-flat', sortMode: 'alpha', label: 'Alphabétique à plat' },
  { treeSort: 'alpha-tree', sortMode: 'alpha', label: 'Alphabétique par groupe' },
];

function PertSortButton({ treeSort, sortMode, onTreeSortChange, onSortModeChange }: {
  treeSort: TreeSort;
  sortMode: 'rank' | 'alpha';
  onTreeSortChange: (m: TreeSort) => void;
  onSortModeChange: (m: 'rank' | 'alpha') => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isDefault = treeSort === 'manual' && sortMode === 'rank';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-7 text-xs px-2 rounded hover:bg-accent transition-colors ${!isDefault ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        title="Tri"
      >
        {isDefault ? <ListTree className="w-3.5 h-3.5" /> : <ArrowDownAZ className="w-3.5 h-3.5" />}
        Ordre
      </button>
      {open && pos && createPortal(
        <div ref={dropRef} className="fixed bg-card border rounded-lg shadow-xl py-1 min-w-[220px] z-[9999]" style={{ top: pos.top, left: pos.left }}>
          {PERT_SORT_OPTIONS.map(opt => {
            const active = opt.treeSort === treeSort && opt.sortMode === sortMode;
            return (
              <button
                key={opt.treeSort}
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => { onTreeSortChange(opt.treeSort); onSortModeChange(opt.sortMode); setOpen(false); }}
              >
                <Check className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'opacity-100' : 'opacity-0'}`} />
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function LegendButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-7 text-xs px-2 rounded hover:bg-accent transition-colors text-muted-foreground"
        title="Légende"
      >
        <Info className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Légende</span>
      </button>
      {open && pos && createPortal(
        <div ref={dropRef} className="fixed bg-card border rounded-xl shadow-xl p-4 z-[9999] w-64 space-y-3" style={{ top: pos.top, left: pos.left }}>
          <p className="text-xs font-semibold text-foreground">Contour des nœuds</p>
          <div className="space-y-1.5">
            {[
              { color: '#ef4444', label: 'Bloque (source)' },
              { color: '#fb923c', label: 'Est bloqué (cible)' },
              { color: '#22c55e', label: 'Permet / est permis' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0 border-2" style={{ borderColor: color, backgroundColor: 'transparent' }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0 border" style={{ borderColor: '#e2e8f0' }} />
              <span className="text-xs text-muted-foreground">Aucune relation</span>
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Fond des nœuds</p>
            <p className="text-xs text-muted-foreground">Couleur du statut de l'item (À faire, En cours, Fait…)</p>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Flèches</p>
            <div className="space-y-1.5">
              {[
                { color: '#ef4444', label: 'Bloque →' },
                { color: '#22c55e', label: 'Permet →' },
                { color: '#3b82f6', label: 'Lié à (pointillé)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-4 h-0.5 flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

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
  filteredItemCount?: number;
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
  filter, onFilterChange, statusFilter, onStatusFilterChange,
  totalItemCount, filteredItemCount, referentiels,
}: PertToolbarProps) {
  const filename = buildExportFilename(spaceName, 'pert');

  const extraControls = (
    <>
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
      <PertSortButton treeSort={treeSort} sortMode={sortMode} onTreeSortChange={onTreeSortChange} onSortModeChange={onSortModeChange} />
      <div className="h-4 w-px bg-border mx-1" />
      <LegendButton />
    </>
  );

  const customExport = (
    <ExportDropdownButton
      groups={[
        { options: [{ label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, filename, spaceName) }] },
        { options: [
          { label: 'PNG — vue (.png)', onClick: () => svgRef.current ? exportSvgAsPng(svgRef.current, filename) : Promise.resolve() },
          { label: 'PDF — vue (.pdf)', onClick: () => svgRef.current ? exportSvgAsPdf(svgRef.current, filename) : Promise.resolve() },
        ]},
      ]}
    />
  );

  return (
    <div className="sticky top-0 z-10 flex flex-col">
      {spaceViews && onSetMode && (
        <ViewSelectorBar viewMode="pert" onSetMode={onSetMode} allowedViews={allowedViews ?? null} spaceViews={spaceViews} defaultView={defaultView} />
      )}
      <ViewToolbar
        viewMode="pert"
        spaceId={spaceId}
        spaceRole={spaceRole}
        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
        onNewItem={onNewItem}
        canEdit={canEdit}
        filter={filter}
        onFilterChange={onFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        totalItemCount={totalItemCount}
        filteredItemCount={filteredItemCount}
        referentiels={referentiels}
        isHighlightMode={true}
        extraControls={extraControls}
        customExport={customExport}
      />
    </div>
  );
}

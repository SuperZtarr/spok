import { Minus, Plus, Info } from 'lucide-react';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item } from '@spok/shared';
import { buildExportFilename, exportDataPDF, exportSvgAsPng, exportSvgAsPdf } from '../../lib/exportUtils';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  svgRef: React.RefObject<SVGSVGElement>;
  onNewItem?: () => void;
  canEdit?: boolean;
  activeRelFilters?: Set<string>;
  onToggleRelFilter?: (type: string) => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function PertToolbar({
  zoom, onZoomIn, onZoomOut, onResetZoom,
  hasParents, hasCollapsed, onCollapseAll, onExpandAll,
  items, spaceName, svgRef,
  onNewItem, canEdit,
  activeRelFilters = new Set(), onToggleRelFilter,
  onStartTour, pulseHelp,
}: PertToolbarProps) {
  const filename = buildExportFilename(spaceName, 'pert');

  return (
    <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {canEdit && onNewItem && (
        <button onClick={onNewItem}
          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          + Nouveau
        </button>
      )}
      <div className="h-4 w-px bg-border mx-1" />
      {onToggleRelFilter && (
        <>
          {[
            { type: 'blocks',     label: 'Bloque',   activeClass: 'bg-red-100 text-red-700 border border-red-300',   dot: 'bg-red-500' },
            { type: 'implements', label: 'Permet',   activeClass: 'bg-green-100 text-green-700 border border-green-300', dot: 'bg-green-500' },
            { type: 'relates',    label: 'Lié à',    activeClass: 'bg-blue-100 text-blue-700 border border-blue-300',  dot: 'bg-blue-500' },
          ].map(({ type, label, activeClass, dot }) => {
            const active = activeRelFilters.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggleRelFilter(type)}
                className={`inline-flex items-center gap-1.5 h-7 px-2 rounded text-xs font-medium transition-colors ${active ? activeClass : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                title={active ? `Retirer le filtre "${label}"` : `Filtrer les items "${label}"`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </>
      )}
      {hasParents && (
        <CollapseToggleButton
          isCollapsed={hasCollapsed}
          onToggle={hasCollapsed ? onExpandAll : onCollapseAll}
        />
      )}
      <div className="h-4 w-px bg-border mx-1" />
      <button onClick={onZoomOut} className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground" title="Dézoomer">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button onClick={onResetZoom} className="text-xs w-11 text-center tabular-nums text-muted-foreground hover:text-foreground transition-colors" title="Réinitialiser le zoom">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={onZoomIn} className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground" title="Zoomer">
        <Plus className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1" />
      <LegendButton />
      <ViewHelpButton viewMode="pert" onStartTour={onStartTour} pulse={pulseHelp} />
      <ExportDropdownButton
        groups={[
          { options: [{ label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, filename, spaceName) }] },
          { options: [
            { label: 'PNG — vue (.png)', onClick: () => svgRef.current ? exportSvgAsPng(svgRef.current, filename) : Promise.resolve() },
            { label: 'PDF — vue (.pdf)', onClick: () => svgRef.current ? exportSvgAsPdf(svgRef.current, filename) : Promise.resolve() },
          ]},
        ]}
      />
    </div>
  );
}

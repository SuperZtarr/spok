/* Toolbar de la vue PERT : filtre par type de relation (4 types officiels, source unique
 * constants/relationTypes.ts), zoom, tri rang/alpha, export SVG (sur ViewToolbar).
 * Chaque commande sous HelpHint (textes : pert.help.ts → hints), pas de `title` natif. */
import { Minus, Plus, Info, ArrowUpDown } from 'lucide-react';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item } from '@spok/shared';
import { buildExportFilename, exportDataPDF, exportSvgAsPng, exportSvgAsPdf } from '../../lib/exportUtils';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpHint } from '../../help/HelpHint';
import { help as pertHelp } from './help/pert.help';

/** Infobulles de l'en-tête — textes dans la fiche d'aide (pert.help.ts, hints). */
const PH = pertHelp.hints!;

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
      <HelpHint text={PH.legend}>
        <button
          type="button"
          ref={btnRef}
          data-tour="pert-legend"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 h-7 text-xs px-2 rounded hover:bg-accent transition-colors text-muted-foreground"
          aria-label="Légende"
          aria-expanded={open}
        >
          <Info className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Légende</span>
        </button>
      </HelpHint>
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
  canEdit?: boolean;
  activeRelFilters?: Set<string>;
  onToggleRelFilter?: (type: string) => void;
  pertRankSort?: boolean;
  onTogglePertRankSort?: () => void;
  totalItemCount?: number;
  filteredItemCount?: number;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function PertToolbar({
  zoom, onZoomIn, onZoomOut, onResetZoom,
  hasParents, hasCollapsed, onCollapseAll, onExpandAll,
  items, spaceName, svgRef,
  activeRelFilters = new Set(), onToggleRelFilter,
  pertRankSort = false, onTogglePertRankSort,
  totalItemCount, filteredItemCount,
  onStartTour, pulseHelp,
}: PertToolbarProps) {
  const filename = buildExportFilename(spaceName, 'pert');

  return (
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {onTogglePertRankSort && (
        <HelpHint text={PH.rankSort}>
          <button
            type="button"
            onClick={onTogglePertRankSort}
            data-tour="pert-rank"
            aria-label="Par rang"
            aria-pressed={pertRankSort}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors ${pertRankSort ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Par rang</span>
          </button>
        </HelpHint>
      )}
      <div className="h-4 w-px bg-border mx-1" />
      {onToggleRelFilter && (
        <>
          {/* Un filtre par type officiel (source unique relationTypes, Entraîne compris) */}
          {RELATION_TYPE_LIST.map(({ id: type, label, badgeClass: activeClass, hex }) => {
            const active = activeRelFilters.has(type);
            return (
              <HelpHint key={type} text={(active ? PH.relFilterOn : PH.relFilterOff).replace('{label}', label)}>
                <button
                  type="button"
                  {...(type === RELATION_TYPE_LIST[0].id ? { 'data-tour': 'pert-relation-filter' } : {})}
                  onClick={() => onToggleRelFilter(type)}
                  aria-label={label}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 h-7 px-2 rounded text-xs font-medium transition-colors ${active ? activeClass : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </HelpHint>
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
      <HelpHint text={PH.zoomOut}>
        <button type="button" onClick={onZoomOut} aria-label="Dézoomer" className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground">
          <Minus className="w-3.5 h-3.5" />
        </button>
      </HelpHint>
      <HelpHint text={PH.zoomReset}>
        <button type="button" onClick={onResetZoom} data-tour="pert-zoom" aria-label="Revenir à 100 %" className="text-xs w-11 text-center tabular-nums text-muted-foreground hover:text-foreground transition-colors">
          {Math.round(zoom * 100)}%
        </button>
      </HelpHint>
      <HelpHint text={PH.zoomIn}>
        <button type="button" onClick={onZoomIn} aria-label="Zoomer" className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </HelpHint>
      <div className="flex-1" />
      {totalItemCount !== undefined && (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {filteredItemCount !== undefined && filteredItemCount !== totalItemCount
            ? `${filteredItemCount} / ${totalItemCount} éléments`
            : `${totalItemCount} élément${totalItemCount !== 1 ? 's' : ''}`}
        </span>
      )}
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

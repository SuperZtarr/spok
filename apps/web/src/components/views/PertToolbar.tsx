import { Minus, Plus } from 'lucide-react';
import { CollapseToggleButton } from '../ui/CollapseToggleButton';
import { ExportDropdownButton } from '../ui/ExportDropdownButton';
import type { Item } from '@spok/shared';
import { buildExportFilename, exportDataPDF, exportContainerPNG, exportContainerPDF } from '../../lib/exportUtils';

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
}

export function PertToolbar({
  zoom, onZoomIn, onZoomOut, onResetZoom,
  hasParents, hasCollapsed, onCollapseAll, onExpandAll,
  items, spaceName, containerRef,
}: PertToolbarProps) {
  const filename = buildExportFilename(spaceName, 'pert');

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card/80 backdrop-blur-sm">
      {hasParents && (
        <>
          <CollapseToggleButton
            isCollapsed={hasCollapsed}
            onToggle={hasCollapsed ? onExpandAll : onCollapseAll}
          />
          <div className="h-4 w-px bg-border mx-1" />
        </>
      )}
      <button
        onClick={onZoomOut}
        className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
        title="Dézoomer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onResetZoom}
        className="text-xs w-11 text-center tabular-nums text-muted-foreground hover:text-foreground transition-colors"
        title="Réinitialiser le zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
        title="Zoomer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <div className="h-4 w-px bg-border mx-1" />
      <ExportDropdownButton
        groups={[
          { options: [{ label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, filename, spaceName) }] },
          { options: [
            { label: 'PNG — vue (.png)', onClick: () => containerRef.current ? exportContainerPNG(containerRef.current, filename) : Promise.resolve() },
            { label: 'PDF — vue (.pdf)', onClick: () => containerRef.current ? exportContainerPDF(containerRef.current, filename) : Promise.resolve() },
          ]},
        ]}
      />
    </div>
  );
}

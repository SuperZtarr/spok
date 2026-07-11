/* Tooltip d'une relation (type, items liés, commentaire) au survol dans les vues Gantt/PERT. */
import { createPortal } from 'react-dom';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  blocks:  { label: 'Bloque',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  depends: { label: 'Dépend de', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  relates: { label: 'Lié à',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

interface RelationTooltipProps {
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
  x: number;
  y: number;
}

export function RelationTooltip({ label, relationType, fromTitle, toTitle, x, y }: RelationTooltipProps) {
  const config = TYPE_LABELS[relationType] ?? { label: relationType, color: 'bg-muted text-muted-foreground' };
  return createPortal(
    <div
      className="fixed z-[9999] max-w-[280px] rounded-lg border bg-popover shadow-lg p-3 text-sm pointer-events-none"
      style={{ left: x + 12, top: y - 8 }}
    >
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${config.color}`}>
        {config.label}
      </span>
      <p className="text-xs text-muted-foreground mb-2 truncate">
        {fromTitle} → {toTitle}
      </p>
      <p className="text-sm leading-snug whitespace-pre-wrap">{label}</p>
    </div>,
    document.body
  );
}

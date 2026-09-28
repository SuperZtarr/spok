/* Tooltip d'une relation (type, items liés, commentaire) au survol — Gantt, PERT, graphe, carte des
 * relations, arêtes de la carte mentale. Libellé et badge : source unique constants/relationTypes.ts
 * (type hors liste : nom brut en gris). */
import { createPortal } from 'react-dom';
import { getRelationMeta } from '../constants/relationTypes';

interface RelationTooltipProps {
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
  x: number;
  y: number;
}

export function RelationTooltip({ label, relationType, fromTitle, toTitle, x, y }: RelationTooltipProps) {
  const meta = getRelationMeta(relationType);
  const config = { label: meta.label, color: meta.badgeClass };
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

/* Icône de commentaire sur une relation (SVG partagé Gantt/PERT) — indique un commentaire présent. */
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { RelationTooltip } from './RelationTooltip';

interface RelationCommentIconProps {
  x: number;
  y: number;
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
}

export function RelationCommentIcon({ x, y, label, relationType, fromTitle, toTitle }: RelationCommentIconProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  if (!label) return null;
  return (
    <>
      <div
        className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
        style={{ left: x - 10, top: y - 10, pointerEvents: 'auto' }}
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
      >
        <MessageCircle className="w-3 h-3 text-muted-foreground" />
      </div>
      {tooltip && (
        <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
      )}
    </>
  );
}

export function RelationCommentIconSvg({ x, y, label, relationType, fromTitle, toTitle }: RelationCommentIconProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  if (!label) return null;
  return (
    <foreignObject x={x - 10} y={y - 10} width={20} height={20} style={{ overflow: 'visible' }}>
      <div
        className="flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
      >
        <MessageCircle className="w-3 h-3 text-muted-foreground" />
      </div>
      {tooltip && (
        <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
      )}
    </foreignObject>
  );
}

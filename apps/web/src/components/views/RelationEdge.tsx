/* Arête de relation (SVG) partagée : couleur/marqueur par type, commentaire, sélection. */
import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { RelationTooltip } from '../RelationTooltip';

export function RelationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const label = (data?.label as string) ?? '';
  const relationType = (data?.type as string) ?? 'relates';
  const fromTitle = (data?.fromTitle as string) ?? '';
  const toTitle = (data?.toTitle as string) ?? '';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
          >
            <MessageCircle className="w-3 h-3 text-muted-foreground" />
          </div>
          {tooltip && (
            <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

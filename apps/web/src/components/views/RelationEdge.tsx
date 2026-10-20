/*
 * Arête de relation (SVG) partagée MindMap / Process : couleur/marqueur par type, commentaire en bulle (texte au
 * survol), sélection. data.pathStyle : 'smoothstep' = angles droits (vue Process), avec data.centerX facultatif
 * (voie verticale propre à la flèche) ou data.corridor (contournement des items) ; absent = courbe (MindMap,
 * comportement d'origine — ne pas changer le défaut, zone fragile MindMap).
 */
import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { RelationTooltip } from '../RelationTooltip';

export function RelationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, data,
}: EdgeProps) {
  const pathParams = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  // data.centerX (Process) : abscisse de la voie verticale propre à la flèche (assignEdgeChannels) ;
  // data.corridor : contournement { ex, y, cx } — sortie, voie horizontale libre, entrée (angles droits)
  const centerX = typeof data?.centerX === 'number' ? data.centerX : undefined;
  const corridor = data?.corridor as { ex: number; y: number; cx: number } | undefined;
  const [edgePath, labelX, labelY] = corridor
    ? [
      `M ${sourceX},${sourceY} L ${corridor.ex},${sourceY} L ${corridor.ex},${corridor.y} `
        + `L ${corridor.cx},${corridor.y} L ${corridor.cx},${targetY} L ${targetX},${targetY}`,
      (corridor.ex + corridor.cx) / 2,
      corridor.y,
    ]
    : data?.pathStyle === 'smoothstep'
      ? getSmoothStepPath({ ...pathParams, centerX })
      : getBezierPath(pathParams);
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

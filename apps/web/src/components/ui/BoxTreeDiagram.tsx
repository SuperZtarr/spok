/*
 * Diagramme générique en arbre de boîtes (SVG, auto-fit au conteneur, tooltip au survol).
 * Layout uniquement — le composant ignore la sémantique des nœuds : couleurs, gras/taille du
 * label et contenu du tooltip sont précalculés par l'appelant dans BoxTreeNode. `roots` accepte
 * plusieurs arbres (forêt) placés côte à côte (ex. plusieurs communautés).
 * Utilisé par OrgChartView (membres d'un espace) et UserAccessPage (arbre accès global).
 */
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface BoxTreeNode {
  id: string;
  label: string;
  sublabel?: string;
  fill: string;
  stroke: string;
  textColor: string;
  labelSize?: number; // défaut 12
  labelBold?: boolean; // défaut false
  tooltipExtra?: ReactNode;
  children: BoxTreeNode[];
}

const NODE_W = 160;
const NODE_H = 56;
const H_GAP = 24;
const V_GAP = 60;
const MARGIN = { top: 40, left: 40 };

interface LayoutNode {
  node: BoxTreeNode;
  x: number;
  y: number;
  w: number;
  h: number;
  parentX?: number;
  parentY?: number;
}

function layoutForest(roots: BoxTreeNode[]): { nodes: LayoutNode[]; width: number; height: number } {
  const result: LayoutNode[] = [];
  let maxX = 0;
  let maxY = 0;

  function subtreeWidth(node: BoxTreeNode): number {
    if (node.children.length === 0) return NODE_W;
    const childrenWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0)
      + (node.children.length - 1) * H_GAP;
    return Math.max(NODE_W, childrenWidth);
  }

  function place(node: BoxTreeNode, depth: number, leftX: number, parentX?: number, parentY?: number) {
    const sw = subtreeWidth(node);
    const cx = leftX + sw / 2;
    const cy = MARGIN.top + depth * (NODE_H + V_GAP);

    result.push({
      node,
      x: cx - NODE_W / 2,
      y: cy,
      w: NODE_W,
      h: NODE_H,
      parentX,
      parentY: parentY !== undefined ? parentY + NODE_H : undefined,
    });

    if (cx + NODE_W / 2 > maxX) maxX = cx + NODE_W / 2;
    if (cy + NODE_H > maxY) maxY = cy + NODE_H;

    let childLeft = leftX;
    for (const child of node.children) {
      const cw = subtreeWidth(child);
      place(child, depth + 1, childLeft, cx, cy);
      childLeft += cw + H_GAP;
    }
  }

  let left = MARGIN.left;
  for (const root of roots) {
    const w = subtreeWidth(root);
    place(root, 0, left);
    left += w + H_GAP;
  }

  return { nodes: result, width: maxX + MARGIN.left, height: maxY + MARGIN.top };
}

export function BoxTreeDiagram({ roots }: { roots: BoxTreeNode[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: BoxTreeNode } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => (roots.length > 0 ? layoutForest(roots) : null), [roots]);

  const viewBox = useMemo(() => {
    if (!layout) return `0 0 ${dimensions.width} ${dimensions.height}`;
    const contentW = Math.max(layout.width, dimensions.width);
    const contentH = Math.max(layout.height, dimensions.height);
    return `0 0 ${contentW} ${contentH}`;
  }, [layout, dimensions]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, node: BoxTreeNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (!layout) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucune donnée
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 relative overflow-auto" style={{ userSelect: 'none' }}>
      <svg
        width={Math.max(layout.width, dimensions.width)}
        height={Math.max(layout.height, dimensions.height)}
        viewBox={viewBox}
      >
        {/* Connectors */}
        {layout.nodes.map((ln) => {
          if (ln.parentX === undefined || ln.parentY === undefined) return null;
          const childCx = ln.x + ln.w / 2;
          const childTop = ln.y;
          const midY = (ln.parentY + childTop) / 2;
          return (
            <path
              key={`edge-${ln.node.id}`}
              d={`M${ln.parentX},${ln.parentY} C${ln.parentX},${midY} ${childCx},${midY} ${childCx},${childTop}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((ln) => (
          <g
            key={ln.node.id}
            onMouseEnter={(e) => handleMouseEnter(e, ln.node)}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'default' }}
          >
            <rect
              x={ln.x} y={ln.y} width={ln.w} height={ln.h} rx={8}
              fill={ln.node.fill} stroke={ln.node.stroke} strokeWidth={1.5}
            />
            <text
              x={ln.x + ln.w / 2}
              y={ln.y + (ln.node.sublabel ? ln.h / 2 - 4 : ln.h / 2 + 4)}
              textAnchor="middle"
              fill={ln.node.textColor}
              fontSize={ln.node.labelSize ?? 12}
              fontWeight={ln.node.labelBold ? 600 : 500}
              style={{ pointerEvents: 'none' }}
            >
              {ln.node.label.length > 18 ? ln.node.label.slice(0, 18) + '…' : ln.node.label}
            </text>
            {ln.node.sublabel && (
              <text
                x={ln.x + ln.w / 2}
                y={ln.y + ln.h / 2 + 12}
                textAnchor="middle"
                fill={ln.node.textColor}
                fillOpacity={0.6}
                fontSize={10}
                style={{ pointerEvents: 'none' }}
              >
                {ln.node.sublabel.length > 22 ? ln.node.sublabel.slice(0, 22) + '…' : ln.node.sublabel}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm z-50"
          style={{
            left: Math.min(tooltip.x + 12, dimensions.width - 200),
            top: Math.min(tooltip.y + 12, dimensions.height - 60),
          }}
        >
          <div className="font-medium">{tooltip.node.label}</div>
          {tooltip.node.sublabel && (
            <div className="text-xs text-muted-foreground mt-0.5">{tooltip.node.sublabel}</div>
          )}
          {tooltip.node.tooltipExtra && <div className="text-xs mt-0.5">{tooltip.node.tooltipExtra}</div>}
        </div>
      )}
    </div>
  );
}

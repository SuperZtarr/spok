import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Maximize2 } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Item } from '@spok/shared';

const NODE_COLORS: Record<string, string> = {
  PROJECT: '#3b82f6',
  NOTE: '#22c55e',
  TASK: '#f97316',
  MEETING: '#a855f7',
  PERIOD: '#06b6d4',
  LINK: '#6366f1',
  CONFIG: '#64748b',
  DOCUMENT: '#78716c',
  IMAGE: '#ec4899',
  BUG: '#ef4444',
};

const RELATION_COLORS: Record<string, string> = {
  blocks: '#ef4444',
  depends: '#f97316',
  relates: '#a855f7',
};

const RELATION_LABELS: Record<string, string> = {
  blocks: 'Bloque',
  depends: 'Dépend de',
  relates: 'Lié à',
};

interface GraphNode {
  id: string;
  title: string;
  type: string;
  color: string;
  hasRelations: boolean;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  color: string;
}

interface RelationsMapViewProps {
  items: Item[];
  onNodeClick: (itemId: string) => void;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
  currentSpaceId?: string;
}

export function RelationsMapView({
  items,
  onNodeClick,
  highlightType,
  highlightStatus,
  searchMatchIds,
}: RelationsMapViewProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [visibleRelTypes, setVisibleRelTypes] = useState<string[]>(['blocks', 'depends', 'relates']);
  const [showOrphans, setShowOrphans] = useState(false);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build graph data from item relations
  const graphData = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const links: GraphLink[] = [];
    const connectedIds = new Set<string>();

    for (const item of items) {
      const relationsFrom = (item as any).relationsFrom || [];
      const relationsTo = (item as any).relationsTo || [];

      for (const rel of relationsFrom) {
        const relType = rel.type || 'relates';
        if (!visibleRelTypes.includes(relType)) continue;
        const targetId = rel.toItem?.id || rel.toItemId;
        if (!targetId) continue;
        links.push({
          source: item.id,
          target: targetId,
          type: relType,
          color: RELATION_COLORS[relType] || '#94a3b8',
        });
        connectedIds.add(item.id);
        connectedIds.add(targetId);
      }

      for (const rel of relationsTo) {
        const relType = rel.type || 'relates';
        if (!visibleRelTypes.includes(relType)) continue;
        const sourceId = rel.fromItem?.id || rel.fromItemId;
        if (!sourceId) continue;
        // Avoid duplicates: only add if source not in our items (cross-space)
        if (!itemMap.has(sourceId)) {
          links.push({
            source: sourceId,
            target: item.id,
            type: relType,
            color: RELATION_COLORS[relType] || '#94a3b8',
          });
          connectedIds.add(sourceId);
          connectedIds.add(item.id);
        }
      }
    }

    const nodes: GraphNode[] = [];
    for (const item of items) {
      const hasRelations = connectedIds.has(item.id);
      if (!hasRelations && !showOrphans) continue;
      nodes.push({
        id: item.id,
        title: item.title,
        type: item.type,
        color: NODE_COLORS[item.type] || '#64748b',
        hasRelations,
      });
    }

    // Add nodes for cross-space items that are targets but not in our items list
    for (const link of links) {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      for (const id of [sourceId, targetId]) {
        if (!nodes.find((n) => n.id === id)) {
          nodes.push({
            id,
            title: '(autre espace)',
            type: 'LINK',
            color: '#94a3b8',
            hasRelations: true,
          });
        }
      }
    }

    return { nodes, links };
  }, [items, visibleRelTypes, showOrphans]);

  // Fit to screen on data change
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(400, 60), 300);
    }
  }, [graphData]);

  const handleFit = useCallback(() => {
    graphRef.current?.zoomToFit(400, 60);
  }, []);

  const toggleRelType = (type: string) => {
    setVisibleRelTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Highlight logic
  const isHighlighted = useCallback(
    (node: GraphNode) => {
      if (searchMatchIds && searchMatchIds.size > 0) {
        return searchMatchIds.has(node.id);
      }
      if (highlightType) return node.type === highlightType;
      if (highlightStatus) {
        const item = items.find((i) => i.id === node.id);
        return item?.status === highlightStatus;
      }
      return false;
    },
    [searchMatchIds, highlightType, highlightStatus, items]
  );

  const hasHighlight = !!(searchMatchIds?.size || highlightType || highlightStatus);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      {/* Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Relation type toggles */}
        <div data-tour="relations-filters" className="bg-card/90 backdrop-blur border rounded-lg p-2 flex flex-col gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Relations</span>
          {Object.entries(RELATION_LABELS).map(([type, label]) => (
            <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={visibleRelTypes.includes(type)}
                onChange={() => toggleRelType(type)}
                className="rounded"
              />
              <span
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: RELATION_COLORS[type] }}
              />
              {label}
            </label>
          ))}
          <div className="border-t border-border pt-1 mt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showOrphans}
                onChange={() => setShowOrphans((v) => !v)}
                className="rounded"
              />
              Sans relations
            </label>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground bg-card/90 backdrop-blur border rounded px-2 py-1">
          {graphData.nodes.length} noeuds · {graphData.links.length} liens
        </div>
      </div>

      {/* Fit button */}
      <div className="absolute top-3 right-3 z-10">
        <Button variant="bordered" size="sm" onClick={handleFit} title="Recentrer">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {graphData.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Aucune relation trouvée entre les éléments.</p>
        </div>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel={(node: any) => `${node.title} (${node.type})`}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.title;
            const fontSize = Math.max(11 / globalScale, 2);
            const nodeR = node.hasRelations ? 6 : 3;
            const highlighted = hasHighlight && isHighlighted(node);
            const dimmed = hasHighlight && !highlighted;

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI);
            ctx.fillStyle = dimmed ? `${node.color}40` : node.color;
            ctx.fill();

            // Highlight ring
            if (highlighted) {
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }

            // Label
            if (globalScale > 0.6) {
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = dimmed ? '#94a3b880' : '#e2e8f0';
              ctx.fillText(
                label.length > 30 ? label.substring(0, 30) + '…' : label,
                node.x,
                node.y + nodeR + 2
              );
            }
          }}
          linkColor={(link: any) => link.color}
          linkWidth={1.5}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalParticles={0}
          onNodeClick={(node: any) => onNodeClick(node.id)}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.3}
          cooldownTicks={100}
          backgroundColor="transparent"
        />
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Maximize2, FolderKanban, Building2, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { useGraphData } from '../../hooks/useGraphData';

const STORAGE_KEY = 'graph-link-types';
const SCOPE_STORAGE_KEY = 'graph-scope';

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
};

const LINK_COLORS: Record<string, string> = {
  hierarchy: '#94a3b8',
  relation: '#a855f7',
  tag: '#7dd3fc',
};

const LINK_LABELS: Record<string, string> = {
  hierarchy: 'Hierarchie',
  relation: 'Relations',
  tag: 'Tags communs',
};

type Scope = 'space' | 'community' | 'global';

interface GraphViewProps {
  level: Scope;
  entityId?: string;
  /** spaceId when level=space, needed to build scope options */
  spaceId?: string;
  spaceName?: string;
  communityId?: string;
  communityName?: string;
  onNodeClick: (itemId: string, spaceId: string) => void;
}

export function GraphView({ level, entityId, spaceId, spaceName, communityId, communityName, onNodeClick }: GraphViewProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Scope selector — starts at the level prop, user can widen/narrow
  const [scope, setScope] = useState<Scope>(() => {
    try {
      const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
      if (saved && ['space', 'community', 'global'].includes(saved)) return saved as Scope;
    } catch { /* ignore */ }
    return level;
  });

  // Reset scope when the level prop changes (e.g. navigating to a different page)
  useEffect(() => { setScope(level); }, [level]);

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  }, [scope]);

  // Compute the active entityId based on scope
  const activeEntityId = useMemo(() => {
    if (scope === 'space') return spaceId || entityId;
    if (scope === 'community') return communityId || entityId;
    return undefined; // global
  }, [scope, spaceId, communityId, entityId]);

  // Available scopes depend on context
  const scopeOptions = useMemo(() => {
    const opts: { value: Scope; label: string; icon: typeof FolderKanban; available: boolean }[] = [
      { value: 'space', label: spaceName || 'Espace', icon: FolderKanban, available: !!(spaceId || (level === 'space' && entityId)) },
      { value: 'community', label: communityName || 'Communaute', icon: Building2, available: !!(communityId || (level === 'community' && entityId)) },
      { value: 'global', label: 'Global', icon: Globe, available: true },
    ];
    return opts.filter(o => o.available);
  }, [spaceId, communityId, spaceName, communityName, level, entityId]);

  // Link type toggles (persisted in localStorage)
  const [activeLinkTypes, setActiveLinkTypes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set(['hierarchy', 'relation', 'tag']);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...activeLinkTypes]));
  }, [activeLinkTypes]);

  const toggleLinkType = (type: string) => {
    setActiveLinkTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const linkTypesArray = useMemo(() => [...activeLinkTypes], [activeLinkTypes]);
  const { data, isLoading } = useGraphData(scope, activeEntityId, linkTypesArray);

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fit view once data loads
  useEffect(() => {
    if (data && graphRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [data]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.links.map(l => ({ ...l })),
    };
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    if (node?.id && node?.spaceId) {
      onNodeClick(node.id, node.spaceId);
    }
  }, [onNodeClick]);

  const handleFitView = () => {
    graphRef.current?.zoomToFit(400, 50);
  };

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.title || '';
    const fontSize = Math.max(12 / globalScale, 2);
    const nodeRadius = 5;
    const color = NODE_COLORS[node.type] || '#94a3b8';

    // Draw circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Draw label
    if (globalScale > 0.5) {
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#e2e8f0';
      const maxChars = Math.max(10, Math.floor(30 / Math.max(1, 2 / globalScale)));
      const truncated = label.length > maxChars ? label.slice(0, maxChars) + '...' : label;
      ctx.fillText(truncated, node.x, node.y + nodeRadius + 2);
    }
  }, []);

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const linkColor = useCallback((link: any) => {
    return LINK_COLORS[link.linkType] || '#475569';
  }, []);

  const linkWidth = useCallback((link: any) => {
    if (link.linkType === 'hierarchy') return 1.5;
    if (link.linkType === 'relation') return 2;
    return 0.5;
  }, []);

  const linkLineDash = useCallback((link: any) => {
    if (link.linkType === 'tag') return [4, 4];
    return null;
  }, []);

  const nodeLabel = useCallback((node: any) => {
    return `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:13px;max-width:250px;">
      <strong>${node.title}</strong><br/>
      <span style="color:#94a3b8">${node.type} — ${node.spaceName}</span>
    </div>`;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Chargement du graphe...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Aucun element a afficher dans le graphe.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      {/* Control panel */}
      <div className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur border rounded-lg p-3 space-y-2 shadow-lg">
        {/* Scope selector */}
        {scopeOptions.length > 1 && (
          <>
            <div className="text-xs font-medium text-muted-foreground mb-1">Perimetre</div>
            <div className="flex flex-col gap-1">
              {scopeOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setScope(opt.value)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-left ${
                      scope === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t my-1" />
          </>
        )}
        <div className="text-xs font-medium text-muted-foreground mb-1">Liens</div>
        {(['hierarchy', 'relation', 'tag'] as const).map(type => (
          <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeLinkTypes.has(type)}
              onChange={() => toggleLinkType(type)}
              className="rounded"
            />
            <span
              className="w-3 h-0.5 inline-block rounded"
              style={{ backgroundColor: LINK_COLORS[type] }}
            />
            {LINK_LABELS[type]}
          </label>
        ))}
        <div className="pt-1 border-t">
          <Button variant="ghost" size="sm" onClick={handleFitView} className="w-full justify-start">
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Recentrer
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {data.nodes.length} noeuds, {data.links.length} liens
        </div>
      </div>

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={nodePointerAreaPaint}
        nodeLabel={nodeLabel}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkLineDash={linkLineDash}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
      />
    </div>
  );
}

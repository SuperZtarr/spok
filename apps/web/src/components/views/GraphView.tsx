import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useQuery } from '@tanstack/react-query';
import { Maximize2, FolderKanban, Building2, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { useGraphData } from '../../hooks/useGraphData';
import { communitiesApi } from '../../lib/api';

const STORAGE_KEY = 'graph-link-types';
const SCOPE_STORAGE_KEY = 'graph-scope';
const COMMUNITY_FILTER_KEY = 'graph-community-filter';

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
  SPACE: '#f59e0b',
  COMMUNITY: '#ef4444',
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
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
}

export function GraphView({ level, entityId, spaceId, spaceName, communityId, communityName, onNodeClick, highlightType, highlightStatus }: GraphViewProps) {
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

  // Fetch user's communities for the filter (only when scope could use it)
  const { data: userCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
    enabled: scope === 'global' || scope === 'community',
  });

  // Community filter (persisted in localStorage) — null means "all"
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<Set<string> | null>(() => {
    try {
      const saved = localStorage.getItem(COMMUNITY_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch { /* ignore */ }
    return null; // null = show all
  });

  // Initialize selected communities to all when list first loads
  useEffect(() => {
    if (userCommunities && selectedCommunityIds === null) {
      setSelectedCommunityIds(new Set(userCommunities.map(c => c.id)));
    }
  }, [userCommunities, selectedCommunityIds]);

  useEffect(() => {
    if (selectedCommunityIds) {
      localStorage.setItem(COMMUNITY_FILTER_KEY, JSON.stringify([...selectedCommunityIds]));
    }
  }, [selectedCommunityIds]);

  const toggleCommunity = (id: string) => {
    setSelectedCommunityIds(prev => {
      const current = prev || new Set(userCommunities?.map(c => c.id) || []);
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build communityIds array for API
  const communityIdsFilter = useMemo(() => {
    if (scope !== 'global' || !selectedCommunityIds || !userCommunities) return undefined;
    // Only pass filter if not all are selected
    if (selectedCommunityIds.size === userCommunities.length) return undefined;
    return [...selectedCommunityIds];
  }, [scope, selectedCommunityIds, userCommunities]);

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
  const { data, isLoading } = useGraphData(scope, activeEntityId, linkTypesArray, communityIdsFilter);

  // Compute available size from container position in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = window.innerHeight - rect.top;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    // Initial measure (with small delay for layout to settle)
    updateSize();
    const timer = setTimeout(updateSize, 100);

    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
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

  const hasHighlight = !!(highlightType || highlightStatus);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.title || '';
    const isStructural = node.type === 'SPACE' || node.type === 'COMMUNITY';
    const nodeRadius = isStructural ? (node.type === 'COMMUNITY' ? 10 : 8) : 5;
    const fontSize = Math.max((isStructural ? 14 : 12) / globalScale, 2);
    const color = NODE_COLORS[node.type] || '#94a3b8';

    // Determine if this node matches the highlight filter
    const isItemNode = !isStructural;
    const matchesHighlight = !hasHighlight || isStructural ||
      (highlightType && node.type === highlightType) ||
      (highlightStatus && (node.status === highlightStatus || (highlightStatus === 'undefined' && !node.status)));
    const dimmed = hasHighlight && isItemNode && !matchesHighlight;

    // Save context and apply dimming
    ctx.save();
    if (dimmed) {
      ctx.globalAlpha = 0.15;
    }

    // Draw circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = (isStructural ? 2.5 : 1.5) / globalScale;
    ctx.stroke();

    // Draw label
    if (globalScale > 0.5 || isStructural) {
      ctx.font = `${isStructural ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isStructural ? '#fbbf24' : '#e2e8f0';
      const maxChars = Math.max(10, Math.floor(30 / Math.max(1, 2 / globalScale)));
      const truncated = label.length > maxChars ? label.slice(0, maxChars) + '...' : label;
      ctx.fillText(truncated, node.x, node.y + nodeRadius + 2);
    }

    ctx.restore();
  }, [hasHighlight, highlightType, highlightStatus]);

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const isStructural = node.type === 'SPACE' || node.type === 'COMMUNITY';
    ctx.beginPath();
    ctx.arc(node.x, node.y, isStructural ? 12 : 8, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const linkColor = useCallback((link: any) => {
    if (hasHighlight) {
      const source = typeof link.source === 'object' ? link.source : null;
      const target = typeof link.target === 'object' ? link.target : null;
      if (source && target) {
        const sourceStructural = source.type === 'SPACE' || source.type === 'COMMUNITY';
        const targetStructural = target.type === 'SPACE' || target.type === 'COMMUNITY';
        const sourceMatch = sourceStructural ||
          (highlightType && source.type === highlightType) ||
          (highlightStatus && (source.status === highlightStatus || (highlightStatus === 'undefined' && !source.status)));
        const targetMatch = targetStructural ||
          (highlightType && target.type === highlightType) ||
          (highlightStatus && (target.status === highlightStatus || (highlightStatus === 'undefined' && !target.status)));
        if (!sourceMatch || !targetMatch) {
          return 'rgba(100,116,139,0.1)';
        }
      }
    }
    return LINK_COLORS[link.linkType] || '#475569';
  }, [hasHighlight, highlightType, highlightStatus]);

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
    if (node.type === 'COMMUNITY') {
      return `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:13px;">
        <strong>${node.title}</strong><br/>
        <span style="color:#ef4444">Communaute</span>
      </div>`;
    }
    if (node.type === 'SPACE') {
      return `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:13px;">
        <strong>${node.title}</strong><br/>
        <span style="color:#f59e0b">Espace</span>
      </div>`;
    }
    return `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:13px;max-width:250px;">
      <strong>${node.title}</strong><br/>
      <span style="color:#94a3b8">${node.type} — ${node.spaceName}</span>
    </div>`;
  }, []);

  if (isLoading) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Chargement du graphe...
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Aucun element a afficher dans le graphe.
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div ref={containerRef} className="absolute inset-0">
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
        {/* Community filter — only in global scope with multiple communities */}
        {scope === 'global' && userCommunities && userCommunities.length > 1 && (
          <>
            <div className="border-t my-1" />
            <div className="text-xs font-medium text-muted-foreground mb-1">Communautes</div>
            {userCommunities.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCommunityIds?.has(c.id) ?? true}
                  onChange={() => toggleCommunity(c.id)}
                  className="rounded"
                />
                <span
                  className="w-2 h-2 inline-block rounded-full flex-shrink-0"
                  style={{ backgroundColor: NODE_COLORS.COMMUNITY }}
                />
                <span className="truncate max-w-[120px]">{c.name}</span>
              </label>
            ))}
          </>
        )}
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
    </div>
  );
}

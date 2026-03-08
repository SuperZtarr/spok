import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spacesApi } from '../../lib/api';
import type { SpaceMember } from '@spok/shared';

interface OrgChartViewProps {
  spaceId: string;
  spaceName: string;
}

const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2, VIEWER: 3 };
const ROLE_LABELS: Record<string, string> = { OWNER: 'Propriétaire', ADMIN: 'Admin', MEMBER: 'Membre', VIEWER: 'Lecteur' };
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OWNER: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  ADMIN: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  MEMBER: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  VIEWER: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
};

interface TreeNode {
  id: string;
  label: string;
  sublabel?: string;
  role?: string;
  children: TreeNode[];
}

// Layout constants
const NODE_W = 160;
const NODE_H = 56;
const H_GAP = 24;
const V_GAP = 60;
const MARGIN = { top: 40, left: 40 };

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  w: number;
  h: number;
  parentX?: number;
  parentY?: number;
}

function layoutTree(root: TreeNode): { nodes: LayoutNode[]; width: number; height: number } {
  const result: LayoutNode[] = [];
  let maxX = 0;
  let maxY = 0;

  // Compute subtree width bottom-up
  function subtreeWidth(node: TreeNode): number {
    if (node.children.length === 0) return NODE_W;
    const childrenWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0)
      + (node.children.length - 1) * H_GAP;
    return Math.max(NODE_W, childrenWidth);
  }

  function place(node: TreeNode, depth: number, leftX: number, parentX?: number, parentY?: number) {
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

  place(root, 0, MARGIN.left);
  return { nodes: result, width: maxX + MARGIN.left, height: maxY + MARGIN.top };
}

function buildOrgTree(members: SpaceMember[], spaceName: string): TreeNode {
  // Group by role
  const byRole = new Map<string, SpaceMember[]>();
  for (const m of members) {
    const role = m.role || 'MEMBER';
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(m);
  }

  // Sort roles
  const sortedRoles = Array.from(byRole.keys()).sort((a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99));

  // Build tree: space root → role groups → members
  const roleNodes: TreeNode[] = sortedRoles.map((role) => {
    const roleMembers = byRole.get(role)!;
    return {
      id: `role-${role}`,
      label: ROLE_LABELS[role] || role,
      sublabel: `${roleMembers.length}`,
      role,
      children: roleMembers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          id: m.userId,
          label: m.name || m.email,
          sublabel: m.email,
          role: m.role,
          children: [],
        })),
    };
  });

  return {
    id: 'root',
    label: spaceName,
    sublabel: `${members.length} membre${members.length > 1 ? 's' : ''}`,
    children: roleNodes,
  };
}

export function OrgChartView({ spaceId, spaceName }: OrgChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
  });

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

  const tree = useMemo(() => {
    if (!members || members.length === 0) return null;
    return buildOrgTree(members, spaceName);
  }, [members, spaceName]);

  const layout = useMemo(() => {
    if (!tree) return null;
    return layoutTree(tree);
  }, [tree]);

  // Compute viewBox to fit content centered
  const viewBox = useMemo(() => {
    if (!layout) return `0 0 ${dimensions.width} ${dimensions.height}`;
    const contentW = Math.max(layout.width, dimensions.width);
    const contentH = Math.max(layout.height, dimensions.height);
    return `0 0 ${contentW} ${contentH}`;
  }, [layout, dimensions]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreeNode) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Chargement des membres...
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Aucun membre dans cet espace
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Rôles :</span>
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const hasMembers = members.some((m) => m.role === role);
          if (!hasMembers) return null;
          const colors = ROLE_COLORS[role];
          return (
            <div key={role} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
        <div className="ml-auto text-xs text-muted-foreground">
          {members.length} membre{members.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-auto"
        style={{ userSelect: 'none' }}
      >
        {layout && (
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
            {layout.nodes.map((ln) => {
              const isRoot = ln.node.id === 'root';
              const isRole = ln.node.id.startsWith('role-');
              const isMember = !isRoot && !isRole;
              const role = ln.node.role || (isRole ? ln.node.id.replace('role-', '') : '');
              const colors = ROLE_COLORS[role] || ROLE_COLORS.MEMBER;

              let fill = '#ffffff';
              let stroke = '#d1d5db';
              let textColor = '#111827';

              if (isRoot) {
                fill = '#6366f1';
                stroke = '#4f46e5';
                textColor = '#ffffff';
              } else if (isRole) {
                fill = colors.bg;
                stroke = colors.border;
                textColor = colors.text;
              } else if (isMember) {
                fill = colors.bg;
                stroke = colors.border;
                textColor = colors.text;
              }

              return (
                <g
                  key={ln.node.id}
                  onMouseEnter={(e) => handleMouseEnter(e, ln.node)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: 'default' }}
                >
                  <rect
                    x={ln.x}
                    y={ln.y}
                    width={ln.w}
                    height={ln.h}
                    rx={8}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                  {/* Main label */}
                  <text
                    x={ln.x + ln.w / 2}
                    y={ln.y + (ln.node.sublabel ? ln.h / 2 - 4 : ln.h / 2 + 4)}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={isRoot ? 13 : 12}
                    fontWeight={isRoot || isRole ? 600 : 500}
                    style={{ pointerEvents: 'none' }}
                  >
                    {ln.node.label.length > 18
                      ? ln.node.label.slice(0, 18) + '…'
                      : ln.node.label}
                  </text>
                  {/* Sublabel */}
                  {ln.node.sublabel && (
                    <text
                      x={ln.x + ln.w / 2}
                      y={ln.y + ln.h / 2 + 12}
                      textAnchor="middle"
                      fill={textColor}
                      fillOpacity={0.6}
                      fontSize={10}
                      style={{ pointerEvents: 'none' }}
                    >
                      {ln.node.sublabel.length > 22
                        ? ln.node.sublabel.slice(0, 22) + '…'
                        : ln.node.sublabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

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
            {tooltip.node.role && (
              <div className="text-xs mt-0.5" style={{ color: ROLE_COLORS[tooltip.node.role]?.text }}>
                {ROLE_LABELS[tooltip.node.role] || tooltip.node.role}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

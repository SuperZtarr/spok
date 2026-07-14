/* Vue Organigramme : membres d'un espace groupés par rôle, rendu en arbre de boîtes (BoxTreeDiagram). */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spacesApi } from '../../lib/api';
import { BoxTreeDiagram } from '../ui/BoxTreeDiagram';
import type { BoxTreeNode } from '../ui/BoxTreeDiagram';
import type { SpaceMember } from '@spok/shared';

interface OrgChartViewProps {
  spaceId: string;
  spaceName: string;
}

const ROLE_ORDER: Record<string, number> = { OWNER: 0, MEMBER: 1 };
const ROLE_LABELS: Record<string, string> = { OWNER: 'Propriétaire', MEMBER: 'Membre' };
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OWNER: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  MEMBER: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

function buildOrgTree(members: SpaceMember[], spaceName: string): BoxTreeNode {
  // Group by role
  const byRole = new Map<string, SpaceMember[]>();
  for (const m of members) {
    const role = m.role || 'MEMBER';
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(m);
  }

  // Sort roles
  const sortedRoles = Array.from(byRole.keys()).sort((a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99));

  const roleNodes: BoxTreeNode[] = sortedRoles.map((role) => {
    const roleMembers = byRole.get(role)!;
    const colors = ROLE_COLORS[role] || ROLE_COLORS.MEMBER;
    return {
      id: `role-${role}`,
      label: ROLE_LABELS[role] || role,
      sublabel: `${roleMembers.length}`,
      fill: colors.bg,
      stroke: colors.border,
      textColor: colors.text,
      labelBold: true,
      tooltipExtra: <span style={{ color: colors.text }}>{ROLE_LABELS[role] || role}</span>,
      children: roleMembers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m): BoxTreeNode => {
          const mRole = m.role || 'MEMBER';
          const mColors = ROLE_COLORS[mRole] || ROLE_COLORS.MEMBER;
          return {
            id: m.userId,
            label: m.name || m.email,
            sublabel: m.email,
            fill: mColors.bg,
            stroke: mColors.border,
            textColor: mColors.text,
            tooltipExtra: <span style={{ color: mColors.text }}>{ROLE_LABELS[mRole] || mRole}</span>,
            children: [],
          };
        }),
    };
  });

  return {
    id: 'root',
    label: spaceName,
    sublabel: `${members.length} membre${members.length > 1 ? 's' : ''}`,
    fill: '#6366f1',
    stroke: '#4f46e5',
    textColor: '#ffffff',
    labelSize: 13,
    labelBold: true,
    children: roleNodes,
  };
}

export function OrgChartView({ spaceId, spaceName }: OrgChartViewProps) {
  const { data: members, isLoading } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
  });

  const tree = useMemo(() => {
    if (!members || members.length === 0) return null;
    return buildOrgTree(members, spaceName);
  }, [members, spaceName]);

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

      <BoxTreeDiagram roots={tree ? [tree] : []} />
    </div>
  );
}

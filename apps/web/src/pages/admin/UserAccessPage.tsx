/*
 * Admin (/admin/users/:userId/access) : arbre communautés → espaces pour un utilisateur, avec
 * son accès effectif sur chaque nœud (adhésion directe, hérité de la visibilité d'espace/communauté,
 * bypass admin global, ou aucun accès — auquel cas un admin pourrait lui en accorder un).
 * Réutilise BoxTreeDiagram (moteur de layout partagé avec OrgChartView) et GET /admin/users/:id/access-tree.
 */
import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { BoxTreeDiagram } from '../../components/ui/BoxTreeDiagram';
import type { BoxTreeNode } from '../../components/ui/BoxTreeDiagram';
import type { AccessTreeNode, AccessRole, AccessSource } from '@spok/shared';

const ROLE_LABELS: Record<Exclude<AccessRole, null>, string> = {
  OWNER: 'Propriétaire',
  MEMBER: 'Membre',
  VIEWER: 'Lecture seule',
  ADMIN: 'Admin (bypass global)',
};

const SOURCE_LABELS: Record<Exclude<AccessSource, null>, string> = {
  direct: 'adhésion directe',
  community: 'hérité de la communauté',
  public: 'communauté publique',
  admin: 'accès admin global',
};

const ROLE_COLORS: Record<Exclude<AccessRole, null>, { bg: string; border: string; text: string }> = {
  OWNER: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  MEMBER: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  VIEWER: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  ADMIN: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
};
const NO_ACCESS_COLORS = { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' };

function toBoxNode(node: AccessTreeNode): BoxTreeNode {
  const colors = node.role ? ROLE_COLORS[node.role] : NO_ACCESS_COLORS;
  const isImplicit = node.source === 'community' || node.source === 'public';
  return {
    id: node.id,
    label: node.name,
    sublabel: node.kind === 'community' ? 'Communauté' : 'Espace',
    fill: colors.bg,
    stroke: colors.border,
    textColor: colors.text,
    labelBold: node.kind === 'community',
    labelSize: node.kind === 'community' ? 13 : 12,
    tooltipExtra: node.role ? (
      <span style={{ color: colors.text }}>
        {ROLE_LABELS[node.role]}
        {isImplicit ? ` (${SOURCE_LABELS[node.source as Exclude<AccessSource, null>]})` : ''}
      </span>
    ) : (
      <span style={{ color: NO_ACCESS_COLORS.text }}>Aucun accès — pourrait être ajouté</span>
    ),
    children: node.children.map(toBoxNode),
  };
}

export function UserAccessPage() {
  const { userId } = useParams<{ userId: string }>();

  const { data: user } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminApi.users.get(userId!),
    enabled: !!userId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId, 'access-tree'],
    queryFn: () => adminApi.users.accessTree(userId!),
    enabled: !!userId,
  });

  const roots = useMemo(() => (data?.tree || []).map(toBoxNode), [data]);

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link to="/admin/users" className="text-muted-foreground hover:text-foreground" aria-label="Retour aux utilisateurs">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Accès de {user?.name || user?.email || '…'}</h1>
          <p className="text-sm text-muted-foreground">Communautés et espaces — accès effectif et accès possible</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 flex-shrink-0 text-xs">
        {(Object.keys(ROLE_LABELS) as Exclude<AccessRole, null>[]).map((role) => (
          <div key={role} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
              style={{ backgroundColor: ROLE_COLORS[role].bg, borderColor: ROLE_COLORS[role].border }}
            />
            <span className="text-muted-foreground">{ROLE_LABELS[role]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
            style={{ backgroundColor: NO_ACCESS_COLORS.bg, borderColor: NO_ACCESS_COLORS.border }}
          />
          <span className="text-muted-foreground">Aucun accès (pourrait être ajouté)</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Chargement…</div>
      ) : roots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Aucune communauté</div>
      ) : (
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden flex flex-col">
          <BoxTreeDiagram roots={roots} />
        </div>
      )}
    </div>
  );
}

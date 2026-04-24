import { useState, useMemo } from 'react';
import { MessageSquare, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import type { Item, SpaceReferentiels, ContributionWithAuthor } from '@spok/shared';
import { getTypeIcon, getTypeColor } from '../../constants/ui';

interface ItemWithContributions extends Item {
  contributions?: ContributionWithAuthor[];
  _count?: { contributions?: number };
  createdBy?: { id: string; name: string; email: string };
}

interface ThreadViewProps {
  items: ItemWithContributions[];
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  searchMatchIds?: Set<string>;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getLastActivity(item: ItemWithContributions): { date: string; authorName?: string } {
  const contribs = item.contributions || [];
  if (contribs.length === 0) return { date: item.updatedAt };
  // Find latest contribution by date
  let latest = contribs[0];
  for (const c of contribs) {
    if (new Date(c.createdAt) > new Date(latest.createdAt)) latest = c;
  }
  return { date: latest.createdAt, authorName: latest.author?.name };
}

function getContributionCount(item: ItemWithContributions): number {
  return item._count?.contributions ?? item.contributions?.length ?? 0;
}

interface ItemTreeNode extends ItemWithContributions {
  children: ItemTreeNode[];
}

function buildItemTree(items: ItemWithContributions[]): ItemTreeNode[] {
  const map = new Map<string, ItemTreeNode>();
  const roots: ItemTreeNode[] = [];
  items.forEach(i => map.set(i.id, { ...i, children: [] }));
  items.forEach(i => {
    if (i.parentId && map.has(i.parentId)) {
      map.get(i.parentId)!.children.push(map.get(i.id)!);
    } else {
      roots.push(map.get(i.id)!);
    }
  });

  // Sort each level by last activity (most recent first)
  const sortByActivity = (nodes: ItemTreeNode[]) => {
    nodes.sort((a, b) => {
      const aLast = getLastActivity(a).date;
      const bLast = getLastActivity(b).date;
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });
    nodes.forEach(n => sortByActivity(n.children));
  };
  sortByActivity(roots);

  return roots;
}

export function ThreadView({
  items,
  onEdit,
  onDelete,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpenInNewTab,
  referentiels,
  canEdit,
  canEditItem,
  searchMatchIds,
}: ThreadViewProps) {
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  // Build item tree (parent-child hierarchy)
  const itemTree = useMemo(() => {
    if (!items) return [];
    return buildItemTree(items);
  }, [items]);

  const toggleThread = (itemId: string) => {
    setExpandedThreadId(prev => prev === itemId ? null : itemId);
  };

  // Build contribution tree for expanded thread
  const renderContributions = (contributions: ContributionWithAuthor[]) => {
    const rootContribs = contributions.filter(c => !c.parentId);
    const childrenMap = new Map<string, ContributionWithAuthor[]>();
    contributions.filter(c => c.parentId).forEach(c => {
      const arr = childrenMap.get(c.parentId!) || [];
      arr.push(c);
      childrenMap.set(c.parentId!, arr);
    });

    const renderContrib = (contrib: ContributionWithAuthor, depth: number): JSX.Element => {
      const children = childrenMap.get(contrib.id) || [];
      return (
        <div key={contrib.id} className={depth > 0 ? 'ml-6 border-l-2 border-border pl-3' : ''}>
          <div className="py-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>p]:my-0.5"
              dangerouslySetInnerHTML={{ __html: contrib.content }}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="font-medium">{contrib.author.name}</span>
              <span>·</span>
              <span>{formatRelativeDate(contrib.createdAt)}</span>
            </div>
          </div>
          {children.map(child => renderContrib(child, depth + 1))}
        </div>
      );
    };

    return (
      <div className="divide-y divide-border/50">
        {rootContribs.map(c => renderContrib(c, 0))}
      </div>
    );
  };

  const renderItemNode = (node: ItemTreeNode, depth: number) => {
    const isExpanded = expandedThreadId === node.id;
    const contribCount = getContributionCount(node);
    const lastActivity = getLastActivity(node);
    const TypeIcon = getTypeIcon(node.type, node.url);
    const typeColor = getTypeColor(node.type, referentiels?.typeLabels);
    const typeLabel = referentiels?.typeLabels?.[node.type]?.labelShort || node.type;
    const isMatch = !searchMatchIds || searchMatchIds.has(node.id);
    const statusObj = referentiels?.statuses?.find((s: any) => s.id === node.status);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div className={`${!isMatch ? 'opacity-30' : ''}`}>
          {/* Thread header row */}
          <div
            className={`flex items-center gap-3 py-3 cursor-pointer transition-colors ${
              isExpanded ? 'bg-accent/50' : 'hover:bg-accent/30'
            }`}
            style={{ paddingLeft: `${1 + depth * 1.5}rem`, paddingRight: '1rem' }}
            onClick={() => toggleThread(node.id)}
          >
            {/* Expand icon */}
            <div className="flex-shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>

            {/* Type badge */}
            <div
              className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: typeColor.bgHover, color: typeColor.color }}
              title={typeLabel}
            >
              <TypeIcon className="w-3.5 h-3.5" />
            </div>

            {/* Title + author */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${depth === 0 ? 'font-medium' : 'font-normal'}`}>{node.title}</p>
              <p className="text-xs text-muted-foreground">
                {node.createdBy?.name || 'Inconnu'}
                {statusObj && (
                  <>
                    <span className="mx-1">·</span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: statusObj.color + '20', color: statusObj.color }}
                    >
                      {statusObj.label}
                    </span>
                  </>
                )}
                {hasChildren && (
                  <>
                    <span className="mx-1">·</span>
                    <span className="text-[10px]">{node.children.length} sous-élément{node.children.length > 1 ? 's' : ''}</span>
                  </>
                )}
              </p>
            </div>

            {/* Contribution count */}
            <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground" title={`${contribCount} contribution${contribCount > 1 ? 's' : ''}`}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="tabular-nums">{contribCount}</span>
            </div>

            {/* Last activity */}
            <div className="flex-shrink-0 text-right min-w-[80px]">
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(lastActivity.date)}
              </p>
              {lastActivity.authorName && (
                <p className="text-[10px] text-muted-foreground/70 truncate max-w-[100px]">
                  {lastActivity.authorName}
                </p>
              )}
            </div>

            {/* Actions */}
            {(canEditItem ? canEditItem(node) : canEdit) && (
              <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                <ItemActionMenu
                  groups={buildItemMenuGroups(node.id, { onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription: hasHeadings(node.description) ? onSplitDescription : undefined, onOpenInNewTab })}
                />
              </div>
            )}
          </div>

          {/* Expanded: description + contributions */}
          {isExpanded && (
            <div className="py-4 bg-background border-t border-border/50" style={{ paddingLeft: `${2.5 + depth * 1.5}rem`, paddingRight: '1rem' }}>
              {/* Description */}
              {node.description && (
                <div className="mb-4 pb-4 border-b border-border/50">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: node.description }}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {node.createdBy?.name} · {formatRelativeDate(node.createdAt)}
                  </p>
                </div>
              )}

              {/* Contributions */}
              {node.contributions && node.contributions.length > 0 ? (
                renderContributions(node.contributions)
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucune contribution pour le moment</p>
              )}

              {/* Open in edit modal */}
              <button
                onClick={() => onEdit(node.id)}
                className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Ouvrir la fiche complète →
              </button>
            </div>
          )}
        </div>

        {/* Render children with increased depth */}
        {node.children.length > 0 && node.children.map(child => renderItemNode(child, depth + 1))}
      </div>
    );
  };

  if (!itemTree.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune discussion dans cet espace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Thread list — forum style with hierarchy */}
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {itemTree.map(node => renderItemNode(node, 0))}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { MessageSquare, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import type { Item, SpaceReferentiels, ContributionWithAuthor } from '@spok/shared';
import { getTypeIcon, getTypeColor } from '../../constants/ui';

interface ItemWithContributions extends Item {
  contributions?: ContributionWithAuthor[];
  _count?: { contributions?: number };
  createdBy?: { id: string; name: string; email: string };
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
}

interface ThreadViewProps {
  items: ItemWithContributions[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
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
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
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

export function ThreadView({
  items,
  currentSpaceId,
  onEdit,
  onDelete,
  onUpdateStatus,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  referentiels,
  canEdit,
  searchMatchIds,
}: ThreadViewProps) {
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  // Sort items by last activity (most recent first)
  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => {
      const aLast = getLastActivity(a).date;
      const bLast = getLastActivity(b).date;
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });
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

  if (!sortedItems.length) {
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
        {/* Thread list — forum style */}
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {sortedItems.map(item => {
            const isExpanded = expandedThreadId === item.id;
            const contribCount = getContributionCount(item);
            const lastActivity = getLastActivity(item);
            const TypeIcon = getTypeIcon(item.type);
            const typeColor = getTypeColor(item.type, referentiels?.typeLabels);
            const typeLabel = referentiels?.typeLabels?.[item.type]?.labelShort || item.type;
            const isMatch = !searchMatchIds || searchMatchIds.has(item.id);
            const statusObj = referentiels?.statuses?.find((s: any) => s.id === item.status);

            return (
              <div
                key={item.id}
                className={`${!isMatch ? 'opacity-30' : ''}`}
              >
                {/* Thread header row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isExpanded ? 'bg-accent/50' : 'hover:bg-accent/30'
                  }`}
                  onClick={() => toggleThread(item.id)}
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
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.createdBy?.name || 'Inconnu'}
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
                  {canEdit && (
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <ItemActionMenu
                        item={item}
                        onEdit={() => onEdit(item.id)}
                        onDelete={onDelete ? () => onDelete(item.id) : undefined}
                        onUpdateStatus={onUpdateStatus}
                        onAddChild={onAddChild ? () => onAddChild(item.id) : undefined}
                        onMoveToSpace={onMoveToSpace ? () => onMoveToSpace(item.id) : undefined}
                        onDuplicateToSpace={onDuplicateToSpace ? () => onDuplicateToSpace(item.id) : undefined}
                        onConvertToSpace={onConvertToSpace ? () => onConvertToSpace(item.id) : undefined}
                        onSelfAssign={onSelfAssign ? () => onSelfAssign(item.id) : undefined}
                        onMerge={onMerge ? () => onMerge(item.id) : undefined}
                        onAbsorbChildren={onAbsorbChildren ? () => onAbsorbChildren(item.id) : undefined}
                        referentiels={referentiels}
                      />
                    </div>
                  )}
                </div>

                {/* Expanded: description + contributions */}
                {isExpanded && (
                  <div className="px-4 py-4 bg-background border-t border-border/50">
                    {/* Description */}
                    {item.description && (
                      <div className="mb-4 pb-4 border-b border-border/50">
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                          dangerouslySetInnerHTML={{ __html: item.description }}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.createdBy?.name} · {formatRelativeDate(item.createdAt)}
                        </p>
                      </div>
                    )}

                    {/* Contributions */}
                    {item.contributions && item.contributions.length > 0 ? (
                      renderContributions(item.contributions)
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aucune contribution pour le moment</p>
                    )}

                    {/* Open in edit modal */}
                    <button
                      onClick={() => onEdit(item.id)}
                      className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Ouvrir la fiche complète →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

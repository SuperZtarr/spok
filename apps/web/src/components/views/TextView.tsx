import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, FileText, MessageSquare, User, FolderKanban, ExternalLink } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { getTypeIcon, getTypeColor } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

interface Contribution {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

interface ItemWithContributions extends Item {
  contributionCount?: number;
  contributions?: Contribution[];
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
}

interface TextViewProps {
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
  onSplitDescription?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
}

function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTree(items: ItemWithContributions[]): ItemWithContributions[] {
  const map = new Map<string, ItemWithContributions & { _children: ItemWithContributions[] }>();
  const roots: (ItemWithContributions & { _children: ItemWithContributions[] })[] = [];

  // Create nodes with _children array
  for (const item of items) {
    map.set(item.id, { ...item, _children: [] });
  }

  // Build hierarchy
  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!._children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Flatten tree in order
  type TreeNode = ItemWithContributions & { _children: TreeNode[] };
  const result: ItemWithContributions[] = [];
  const flatten = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      (node as any)._depth = depth;
      result.push(node);
      flatten(node._children, depth + 1);
    }
  };
  flatten(roots as TreeNode[], 0);
  return result;
}

export function TextView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, referentiels, canEdit, canEditItem, highlightType, highlightStatus, highlightColor, searchMatchIds }: TextViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { statusLabels, statusColors } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const sLabels: Record<string, string> = {};
    const sColors: Record<string, string> = {};
    statuses.forEach((s) => {
      sLabels[s.id] = s.label;
      sColors[s.id] = s.color;
    });
    sColors['none'] = 'bg-gray-100 text-gray-500 border-dashed';
    return { statusLabels: sLabels, statusColors: sColors };
  }, [referentiels]);

  const doneStatusId = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const visibleStatuses = statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order);
    const doneStatus = visibleStatuses.find((s) => s.id === 'done');
    return doneStatus?.id || visibleStatuses[visibleStatuses.length - 1]?.id || 'done';
  }, [referentiels]);

  // Separate items: main space vs portal spaces
  const { mainItems, portalItemGroups } = useMemo(() => {
    if (!currentSpaceId || !portalGroups?.length) {
      return { mainItems: items, portalItemGroups: [] };
    }
    const main = items.filter(i => i.spaceId === currentSpaceId);
    const groups = portalGroups.map(g => ({
      ...g,
      items: items.filter(i => i.spaceId === g.spaceId),
    })).filter(g => g.items.length > 0);
    return { mainItems: main, portalItemGroups: groups };
  }, [items, currentSpaceId, portalGroups]);

  // Build hierarchical order then filter
  const orderedItems = useMemo(() => buildTree(mainItems), [mainItems]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return orderedItems;
    const query = searchQuery.toLowerCase();
    return orderedItems.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      stripMarkup(item.description || '').toLowerCase().includes(query) ||
      (item.contributions || []).some((c) =>
        stripMarkup(c.content || '').toLowerCase().includes(query)
      )
    );
  }, [orderedItems, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher dans les titres, descriptions et contributions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredItems.length === 0 && portalItemGroups.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchQuery ? (
            <>
              <p>Aucun résultat</p>
              <p className="text-sm">Aucun élément ne correspond à "{searchQuery}"</p>
            </>
          ) : (
            <>
              <p>Aucun élément</p>
              <p className="text-sm">Créez votre premier élément pour commencer</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 space-y-1">
          {filteredItems.map((item) => (
            <TextItem
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateStatus={onUpdateStatus}
              onAddChild={onAddChild}
              onMoveToSpace={onMoveToSpace}
              onDuplicateToSpace={onDuplicateToSpace}
              onConvertToSpace={onConvertToSpace}
              onSelfAssign={onSelfAssign}
              onMerge={onMerge}
              onAbsorbChildren={onAbsorbChildren}
              onSplitDescription={onSplitDescription}
              onOpenInNewTab={onOpenInNewTab}
              canEdit={canEdit}
              canEditItem={canEditItem}
              doneStatusId={doneStatusId}
              statusLabels={statusLabels}
              statusColors={statusColors}
              referentiels={referentiels}
              highlightType={highlightType}
              highlightStatus={highlightStatus}
              highlightColor={highlightColor}
              searchMatchIds={searchMatchIds}
            />
          ))}

          {/* Portal sections for items from checked child spaces */}
          {portalItemGroups.map((group) => {
            const groupOrdered = buildTree(group.items);
            const groupFiltered = searchQuery.trim()
              ? groupOrdered.filter((item) =>
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  stripMarkup(item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (item.contributions || []).some((c) =>
                    stripMarkup(c.content || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                )
              : groupOrdered;
            if (groupFiltered.length === 0) return null;
            return (
              <div key={`portal-${group.spaceId}`} className="mt-6">
                <Link
                  to={`/spaces/${group.spaceId}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 hover:bg-accent transition-colors text-sm font-medium text-muted-foreground mb-2"
                >
                  <FolderKanban className="w-4 h-4 text-primary" />
                  <span>{group.spaceName}</span>
                  <span className="text-xs text-muted-foreground/60">({groupFiltered.length})</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </Link>
                {groupFiltered.map((item) => (
                  <TextItem
                    key={item.id}
                    item={item}
                    onEdit={onEdit}
                    onDelete={undefined}
                    onUpdateStatus={undefined}
                    onAddChild={undefined}
                    onMoveToSpace={undefined}
                    onDuplicateToSpace={undefined}
                    onConvertToSpace={undefined}
                    canEdit={false}
                    doneStatusId={doneStatusId}
                    statusLabels={statusLabels}
                    statusColors={statusColors}
                    referentiels={referentiels}
                    highlightType={highlightType}
                    highlightStatus={highlightStatus}
                    highlightColor={highlightColor}
                    searchMatchIds={searchMatchIds}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Extracted item rendering component to avoid duplication between main and portal sections
function TextItem({
  item,
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
  onSplitDescription,
  onOpenInNewTab,
  canEdit,
  canEditItem,
  doneStatusId,
  statusLabels,
  statusColors,
  referentiels,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
}: {
  item: ItemWithContributions;
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
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  doneStatusId: string;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  referentiels?: SpaceReferentiels;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
}) {
  const depth = (item as any)._depth || 0;
  const Icon = getTypeIcon(item.type, item.url);
  const statusLabel = statusLabels[item.status || ''] || 'Non défini';
  const statusColor = statusColors[item.status || 'none'] || statusColors['none'];
  const typeColor = getTypeColor(item.type, referentiels?.typeLabels);
  const hasDescription = !!item.description?.trim();
  const contributions = item.contributions || [];
  const hasImage = item.url && (item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url));
  const hasContent = hasDescription || contributions.length > 0 || hasImage;
  const hasHighlight = !!(highlightType || highlightStatus || searchMatchIds);
  const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
  const isHighlighted = hasHighlight && !isDimmed;
  const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));

  return (
    <div
      className={`group transition-opacity ${isDimmed ? 'opacity-35' : ''}`}
      style={{ marginLeft: `${depth * 32}px` }}
    >
      {/* Item header */}
      <div
        className={`flex items-center gap-2 py-2 cursor-pointer hover:bg-accent/50 rounded-md px-3 -mx-3 transition-colors ${isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''} ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''}`}
        onClick={() => onEdit(item.id)}
      >
        <span className={`flex-shrink-0 ${typeColor.color.replace('border-', 'text-').replace('400', '500')}`}>
          <Icon className="w-5 h-5" />
        </span>
        <h3 className={`font-semibold text-base flex-1 ${depth === 0 ? 'text-lg' : ''}`}>
          {item.title}
        </h3>
        <Badge
          className={`text-xs ${statusColor}`}
          variant="secondary"
        >
          {statusLabel}
        </Badge>
        {contributions.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            {contributions.length}
          </span>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <ItemActionMenu
            groups={buildItemMenuGroups(item.id, {
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
              onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined,
              onOpenInNewTab,
            }, {
              canEdit: canEditItem ? canEditItem(item) : canEdit,
              statusAction: onUpdateStatus && item.status && item.status !== doneStatusId ? { label: 'Marquer terminé', statusId: doneStatusId } : null,
            })}
          />
        </div>
      </div>

      {/* Description & Contributions */}
      {hasContent && (
        <div className="pl-7 pb-3">
          {hasDescription && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground mt-1"
              dangerouslySetInnerHTML={{ __html: item.description! }}
            />
          )}
          {item.url && (item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url)) && (
            <img src={item.url} alt="" className="max-w-sm max-h-48 object-contain rounded border border-border mt-2" />
          )}

          {/* Contributions */}
          {contributions.length > 0 && (
            <div className="mt-3 space-y-3">
              {contributions.map((contrib) => (
                <div
                  key={contrib.id}
                  className="border-l-2 border-primary/30 pl-3 py-1"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <User className="w-3 h-3" />
                    <span className="font-medium">{contrib.author.name}</span>
                    <span>·</span>
                    <span>{formatDate(contrib.createdAt)}</span>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: contrib.content }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Separator for root items */}
      {depth === 0 && <div className="border-b border-border/50 my-2" />}
    </div>
  );
}

/*
 * Arborescence de ListView — TreeItem délègue le rendu de ligne à TreeItemRow (composant partagé
 * avec Gantt/PERT, variant "inline") et garde ici son fetch récursif des enfants (ItemChildren, useQuery).
 * RootDropZone est ré-exportée depuis TreeItemRow.tsx pour ne pas casser les imports existants (SpacePage.tsx).
 */
import { useQuery } from '@tanstack/react-query';
import type { Item } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { itemsApi } from '../lib/api';
import { TreeItemRow } from '../components/views/TreeItemRow';

export { RootDropZone } from '../components/views/TreeItemRow';

// TreeItem props interface
export interface TreeItemProps {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  orderNumber: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  spaceId: string;
  isOver: boolean;
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  globalDropPosition?: 'before' | 'after' | 'nest';  expandedItems: Set<string>;
  canEdit?: boolean;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  statusColorMap: Record<string, string>;
  statusLabelMap: Record<string, string>;
  isFirstTreeItem?: boolean;
}

// Tree item component - uses useDraggable + useDroppable (no transform/reorder animations)
export function TreeItem({
  item,
  depth,
  orderNumber,
  isExpanded,
  onToggleExpand,
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
  onOpen,
  onOpenInNewTab,
  spaceId,
  isOver,
  onMove,
  globalOverId,
  globalDropMode,
  globalDropPosition,  expandedItems,
  canEdit,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
  statusColorMap,
  statusLabelMap,
  isFirstTreeItem,
}: TreeItemProps) {
  const hasHighlight = !!(highlightType || highlightStatus || searchMatchIds);
  const isDimmed = !!((highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id)));
  const isHighlighted = hasHighlight && !isDimmed;
  const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));

  const hasChildren = (item.childCount || 0) > 0;
  const statusOptions = DEFAULT_REFERENTIELS.statuses.filter(s => s.visible).sort((a, b) => a.order - b.order);

  return (
    <>
      <TreeItemRow
        item={item}
        depth={depth}
        variant="inline"
        orderNumber={orderNumber}
        hasChildren={hasChildren}
        isCollapsed={!isExpanded}
        isPortal={false}
        isOver={isOver}
        dropPosition={globalDropPosition || 'nest'}
        canEdit={canEdit}
        onMove={onMove}
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
        onOpen={onOpen}
        onOpenInNewTab={onOpenInNewTab}
        toggleCollapse={onToggleExpand}
        statusOptions={statusOptions}
        statusColorMap={statusColorMap}
        statusLabelMap={statusLabelMap}
        isHighlighted={isHighlighted}
        isDimmed={isDimmed}
        isSearchMatch={isSearchMatch}
        highlightColor={highlightColor}
        isFirstTreeItem={isFirstTreeItem}
      />

      {isExpanded && hasChildren && (
        <ItemChildren
          spaceId={spaceId}
          parentId={item.id}
          depth={depth + 1}
          parentOrderNumber={orderNumber}
          onEditItem={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          onMoveToSpace={onMoveToSpace}
          onDuplicateToSpace={onDuplicateToSpace}
          onConvertToSpace={onConvertToSpace}
          onSelfAssign={onSelfAssign}
          onMerge={onMerge}
          onAbsorbChildren={onAbsorbChildren}
          onOpen={onOpen}
          onOpenInNewTab={onOpenInNewTab}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          globalDropPosition={globalDropPosition}          expandedItems={expandedItems}
          onToggleExpand={onToggleExpand}
          canEdit={canEdit}
          highlightType={highlightType}
          highlightStatus={highlightStatus}
          highlightColor={highlightColor}
          searchMatchIds={searchMatchIds}
          statusColorMap={statusColorMap}
          statusLabelMap={statusLabelMap}
        />
      )}
    </>
  );
}

// Sub-component to load children lazily
export function ItemChildren({
  spaceId,
  parentId,
  depth,
  parentOrderNumber,
  onEditItem,
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
  onOpen,
  onOpenInNewTab,
  onMove,
  globalOverId,
  globalDropMode,
  globalDropPosition,  expandedItems,
  onToggleExpand,
  canEdit,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
  statusColorMap,
  statusLabelMap,
}: {
  spaceId: string;
  parentId: string;
  depth: number;
  parentOrderNumber: string;
  onEditItem: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  globalDropPosition?: 'before' | 'after' | 'nest';  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  canEdit?: boolean;
  highlightType?: string;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  statusColorMap: Record<string, string>;
  statusLabelMap: Record<string, string>;
}) {
  const { data } = useQuery({
    queryKey: ['items', spaceId, 'children', parentId],
    queryFn: () => itemsApi.list(spaceId, { parentId, pageSize: 5000 }),
  });

  if (!data?.data.length) return null;

  return (
    <>
      {data.data.map((item: Item & { childCount?: number }, index: number) => (
        <TreeItem
          key={item.id}
          item={item}
          depth={depth}
          orderNumber={`${parentOrderNumber}.${index + 1}`}
          isExpanded={expandedItems.has(item.id)}
          onToggleExpand={onToggleExpand}
          onEdit={onEditItem}
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
          onOpen={onOpen}
          onOpenInNewTab={onOpenInNewTab}
          spaceId={spaceId}
          isOver={globalOverId === item.id}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          globalDropPosition={globalDropPosition}          expandedItems={expandedItems}
          canEdit={canEdit}
          highlightType={highlightType}
          highlightStatus={highlightStatus}
          highlightColor={highlightColor}
          searchMatchIds={searchMatchIds}
          statusColorMap={statusColorMap}
          statusLabelMap={statusLabelMap}
        />
      ))}
    </>
  );
}

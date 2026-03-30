import { useQuery } from '@tanstack/react-query';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Plus,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Trash2,
  GripVertical,
  ExternalLink,
  FolderInput,
  Copy,
  FolderPlus,
  UserPlus,
  Merge,
  ArrowDownToLine,
  Pencil,
} from 'lucide-react';
import type { Item } from '@spok/shared';
import { itemsApi } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { ItemActionMenu } from '../components/ui/ItemActionMenu';
import { useSelectionStore } from '../stores/selection';
import { getTypeIcon } from '../constants/ui';

// Root drop zone to move items to root level
export function RootDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'root' });

  return (
    <div
      ref={setNodeRef}
      className={`mx-3 mt-2 py-2 px-3 rounded-md border-2 border-dashed transition-colors ${
        isOver
          ? 'border-green-500 bg-green-50 text-green-700'
          : 'border-gray-300 text-gray-400'
      }`}
    >
      <span className="text-sm">↓ Déposer ici pour mettre à la racine</span>
    </div>
  );
}

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
  spaceId: string;
  isOver: boolean;
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  globalDropPosition?: 'before' | 'after' | 'nest';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  expandedItems: Set<string>;
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
  spaceId,
  isOver,
  onMove,
  globalOverId,
  globalDropMode,
  globalDropPosition,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  expandedItems,
  canEdit,
  highlightType,
  highlightStatus,
  highlightColor,
  searchMatchIds,
  statusColorMap,
  statusLabelMap,
  isFirstTreeItem,
}: TreeItemProps) {
  // Draggable (for the grip handle)
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: item.id });

  // Droppable (for receiving drops)
  const {
    setNodeRef: setDropRef,
  } = useDroppable({ id: item.id });

  const hasHighlight = !!(highlightType || highlightStatus || searchMatchIds);
  const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
  const isHighlighted = hasHighlight && !isDimmed;
  const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));

  const currentDropPosition = isOver ? (globalDropPosition || 'nest') : null;

  const Icon = getTypeIcon(item.type, item.url);
  const hasChildren = (item.childCount || 0) > 0;

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(item.id);
    } else {
      onEdit(item.id);
    }
  };

  return (
    <div style={{ opacity: isDragging ? 0.4 : isDimmed ? 0.35 : 1 }}>
      {/* Line before this item (insert before) */}
      {currentDropPosition === 'before' && (
        <div className="relative mx-3 h-0.5" style={{ marginLeft: `${12 + depth * 24}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}
      <div
        ref={setDropRef}
        data-item-id={item.id}
        className={`flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer transition-colors duration-150 ${
          currentDropPosition === 'nest' ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400' : ''
        } ${isSelected ? 'bg-primary/10 border border-primary' : ''} ${isHighlighted && highlightColor ? `border ${highlightColor.border} ${highlightColor.bg}` : ''} ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''}`}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
        onClick={handleClick}
      >
        {isSelectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded"
          />
        ) : canEdit !== false ? (
          <button
            ref={setDragRef}
            {...attributes}
            {...listeners}
            {...(isFirstTreeItem ? { 'data-tour': 'tree-drag' } : {})}
            className="p-0.5 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réorganiser"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : null}

        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            {...(isFirstTreeItem ? { 'data-tour': 'tree-expand' } : {})}
            className="p-0.5 hover:bg-muted rounded"
            title={isExpanded ? 'Réduire' : 'Développer'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className="text-xs text-muted-foreground font-mono min-w-[1.5rem]">{orderNumber}</span>

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate">{item.title}</span>

        {item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url) && (
          <img src={item.url} alt="" className="w-6 h-6 object-cover rounded border border-border flex-shrink-0" />
        )}

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Ouvrir le lien"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <Badge
          className={`text-xs ${statusColorMap[item.status || 'none'] || statusColorMap['undefined'] || 'bg-gray-100 text-gray-500'}`}
          variant="secondary"
        >
          {statusLabelMap[item.status || ''] || statusLabelMap['undefined'] || 'Non défini'}
        </Badge>

        {canEdit !== false && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <ItemActionMenu
              groups={[
                {
                  actions: [
                    { id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(item.id) },
                    ...(item.status && item.status !== 'done' ? [{ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => onUpdateStatus(item.id, 'done') }] : []),
                    { id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(item.id) },
                    ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(item.id) }] : []),
                    ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(item.id) }] : []),
                    ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(item.id) }] : []),
                    ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => onDuplicateToSpace(item.id) }] : []),
                  ],
                },
                {
                  actions: [
                    ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(item.id) }] : []),
                    ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(item.id) }] : []),
                  ],
                },
                {
                  actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' as const }],
                },
              ].filter(g => g.actions.length > 0)}
            />
          </div>
        )}
      </div>

      {/* Line after this item (insert after) */}
      {currentDropPosition === 'after' && (
        <div className="relative mx-3 h-0.5" style={{ marginLeft: `${12 + depth * 24}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}

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
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          globalDropPosition={globalDropPosition}
          isSelectionMode={isSelectionMode}
          onToggleSelection={onToggleSelection}
          expandedItems={expandedItems}
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
    </div>
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
  onMove,
  globalOverId,
  globalDropMode,
  globalDropPosition,
  isSelectionMode,
  onToggleSelection,
  expandedItems,
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
  onMove: (id: string, parentId: string | null, position: number) => void;
  globalOverId: string | null;
  globalDropMode: 'reorder' | 'nest';
  globalDropPosition?: 'before' | 'after' | 'nest';
  isSelectionMode?: boolean;
  onToggleSelection?: (id: string) => void;
  expandedItems: Set<string>;
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

  // Get selection store for checking selection state (must be before any early return)
  const { selectedIds: globalSelectedIds } = useSelectionStore();

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
          spaceId={spaceId}
          isOver={globalOverId === item.id}
          onMove={onMove}
          globalOverId={globalOverId}
          globalDropMode={globalDropMode}
          globalDropPosition={globalDropPosition}
          isSelectionMode={isSelectionMode}
          isSelected={globalSelectedIds.has(item.id)}
          onToggleSelection={onToggleSelection}
          expandedItems={expandedItems}
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

/*
 * Ligne d'item d'arborescence — composant partagé entre ListView ("inline") et Gantt/PERT ("sticky").
 * Fusion de l'ancien TreeItem (pages/space-tree-view.tsx) et TreeItemRow : même comportement (grip
 * toujours visible, statut, menu d'actions, indicateurs avant/après/imbrication drag & drop), layout
 * différent selon le contexte (ligne pleine largeur vs colonne fixe sticky à gauche d'un planning).
 * RootDropZone est co-localisée ici pour être réutilisée par toutes les arborescences (retour à la racine).
 */
import { ChevronDown, ChevronRight, GripVertical, ExternalLink } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Item } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import { getTypeIcon } from '../../constants/ui';

// Zone de dépôt pour remonter un item à la racine de l'espace (drag & drop)
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

export interface TreeItemRowProps {
  item: Item & { childCount?: number; tags?: any[] };
  depth: number;
  // 'inline' = ListView (pleine largeur, arrondi hover) ; 'sticky' = Gantt/PERT (colonne fixe w-72)
  variant?: 'sticky' | 'inline';
  orderNumber?: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  isPortal?: boolean;
  isOver: boolean;
  dropPosition: 'before' | 'after' | 'nest';
  canEdit?: boolean;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (id: string, spaceId?: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  toggleCollapse: (id: string) => void;
  statusOptions: { id: string; label: string; visible?: boolean; order?: number }[];
  canEditItem?: (item: { createdById?: string }) => boolean;
  // Variant 'inline' uniquement : badge de statut visible sur la ligne
  statusColorMap?: Record<string, string>;
  statusLabelMap?: Record<string, string>;
  // Variant 'inline' uniquement : mise en avant/estompage (filtre type/statut, recherche)
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isSearchMatch?: boolean;
  highlightColor?: { border: string; bg: string };
  isFirstTreeItem?: boolean;
}

export function TreeItemRow({
  item,
  depth,
  variant = 'sticky',
  orderNumber,
  hasChildren,
  isCollapsed,
  isPortal,
  isOver,
  dropPosition,
  canEdit,
  onMove,
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
  toggleCollapse,
  statusOptions,
  canEditItem,
  statusColorMap,
  statusLabelMap,
  isHighlighted,
  isDimmed,
  isSearchMatch,
  highlightColor,
  isFirstTreeItem,
}: TreeItemRowProps) {
  const isInline = variant === 'inline';
  const editable = canEdit !== false;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: item.id, disabled: !editable || !onMove });
  const { setNodeRef: setDropRef } = useDroppable({ id: item.id, disabled: !onMove });
  const Icon = getTypeIcon(item.type, item.url);

  const indent = isInline ? 12 + depth * 24 : 8 + depth * 20;
  const nestHighlight = isOver && dropPosition === 'nest';
  const showActionMenu = isInline ? editable : !isPortal;
  const wrapperOpacity = isDragging ? 0.4 : (isInline && isDimmed) ? 0.35 : 1;

  return (
    <div ref={setDropRef} style={{ opacity: wrapperOpacity }}>
      {isOver && dropPosition === 'before' && (
        <div className="relative h-0.5 mx-2" style={{ marginLeft: `${indent}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}
      <div
        data-item-id={item.id}
        className={`${
          isInline
            ? 'flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md group cursor-pointer transition-colors duration-150'
            : 'w-72 flex-shrink-0 px-2 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-muted/50 sticky left-0 z-10 bg-background'
        } ${nestHighlight ? (isInline ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400' : 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-400') : ''} ${
          isInline && isHighlighted && highlightColor ? `border ${highlightColor.border} ${highlightColor.bg}` : ''
        } ${isInline && isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={isInline ? () => onEdit(item.id) : undefined}
      >
        {editable && onMove && (
          <button
            ref={setDragRef}
            {...attributes}
            {...listeners}
            {...(isFirstTreeItem ? { 'data-tour': 'tree-drag' } : {})}
            className="p-0.5 hover:bg-muted rounded cursor-grab active:cursor-grabbing flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réorganiser"
          >
            <GripVertical className={isInline ? 'w-4 h-4 text-muted-foreground' : 'w-3.5 h-3.5 text-muted-foreground'} />
          </button>
        )}

        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
            {...(isFirstTreeItem ? { 'data-tour': 'tree-expand' } : {})}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0"
            title={isCollapsed ? 'Développer' : 'Réduire'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5 flex-shrink-0" />
        )}

        {isInline && orderNumber !== undefined && (
          <span className="text-xs text-muted-foreground font-mono min-w-[1.5rem]">{orderNumber}</span>
        )}

        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span
          className="truncate text-sm flex-1"
          onClick={isInline ? undefined : () => onEdit(item.id)}
          title={item.title}
        >
          {item.title}
        </span>

        {isInline && item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url) && (
          <img src={item.url} alt="" className="w-6 h-6 object-cover rounded border border-border flex-shrink-0" />
        )}

        {isInline && item.url && (
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

        {isInline && statusColorMap && statusLabelMap && (
          <Badge
            className={`text-xs ${statusColorMap[item.status || 'none'] || statusColorMap['undefined'] || 'bg-gray-100 text-gray-500'}`}
            variant="secondary"
          >
            {statusLabelMap[item.status || ''] || statusLabelMap['undefined'] || 'Non défini'}
          </Badge>
        )}

        {showActionMenu && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <ItemActionMenu
              groups={buildItemMenuGroups(item.id, {
                onOpen,
                onOpenInNewTab,
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
                onSplitDescription: onSplitDescription && hasHeadings(item.description) ? onSplitDescription : undefined,
              }, {
                canEdit: canEditItem ? canEditItem(item) : editable,
                statusOptions,
                currentStatusId: item.status || undefined,
                itemSpaceId: item.spaceId,
              })}
            />
          </div>
        )}
      </div>

      {isOver && dropPosition === 'after' && (
        <div className="relative h-0.5 mx-2" style={{ marginLeft: `${indent}px` }}>
          <div className="absolute inset-x-0 h-0.5 bg-primary rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}
    </div>
  );
}

/* Nœuds React Flow de la MindMap : item, espace, portail — rendu et poignées.
 * Intérieur d'un nœud d'item = vignette commune au format ligne (components/item/ItemVignette, lib/itemFace.ts, décision
 * Thomas 2026-11-08), dans la couleur du nœud : miniature ou icône, titre sur une ligne, info principale, pastilles.
 * Le nœud n'en est que le cadre (zone fragile, ne pas y toucher sans vérifier les arêtes) : fond = statut, bordure =
 * priorité, poignées, dépli, épingle, menu ⋮, largeur 90-260 px.
 */
import { useRef, useContext } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { SpaceWithRole } from '@spok/shared';
import { getTypeIcon, getPriorityConfig } from '../../constants/ui';
import { itemFace } from '../../lib/itemFace';
import { ItemVignette } from '../item/ItemVignette';

// Border thickness + color based on priority (higher priority = thicker)
function getPriorityBorder(priority: number | null | undefined): string {
  const cfg = getPriorityConfig(priority);
  const color = cfg ? cfg.color : 'border-gray-300';
  const thickness = cfg
    ? (cfg.value === 4 ? 'border-4' : cfg.value === 3 ? 'border-[3px]' : cfg.value === 2 ? 'border-2' : 'border')
    : 'border-2';
  return `${thickness} ${color}`;
}
import { ChevronRight, ChevronDown, FolderOpen, RotateCcw, ExternalLink, X, Pin, PinOff, GripVertical } from 'lucide-react';
import { SidebarDropContext } from '../Layout';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings, hasChildItems } from '../../lib/itemMenuGroups';
import type { TreeItem } from './mindmap-utils';

// Custom node component for radial layout
export interface MindMapNodeProps {
  data: {
    label: string;
    item: TreeItem;
    statusColor: string;
    hexColor: string;
    textColor: string;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdateStatus: (id: string, status: string) => void;
    onAddChild: (id: string) => void;
    onAddPortal: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    onReorganizeChildren: (id: string) => void;
    onMoveToSpace?: (id: string) => void;
    onDuplicateToSpace?: (id: string) => void;
    onConvertToSpace?: (id: string) => void;
    onSelfAssign?: (id: string) => void;
    onMerge?: (id: string) => void;
    onAbsorbChildren?: (id: string) => void;
    onSplitDescription?: (id: string) => void;
    onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
    statusOptions: Array<{ id: string; label: string }>;
    isRoot: boolean;
    hasChildren: boolean;
    isCollapsed: boolean;
    childCount: number;
    hasPortalSupport: boolean;
    isHighlighted: boolean;
    isDimmed: boolean;
    isSearchMatch: boolean;
    isDropTarget: boolean;
    canEdit: boolean;
    isPinned: boolean;
    onTogglePin: (id: string) => void;
    onSavePosition?: (id: string, pos: { x: number; y: number }) => void;
    isPortal: boolean;
    portalSpaceName?: string;
  };
}

export function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, textColor, onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen, onOpenInNewTab, statusOptions, isRoot, hasChildren, isCollapsed, childCount, hasPortalSupport, isHighlighted, isDimmed, isSearchMatch, isDropTarget, canEdit, isPinned, onTogglePin, onSavePosition, isPortal, portalSpaceName: _portalSpaceName } = data;
  const { dropTargetId: _dt } = useContext(SidebarDropContext); void _dt; // abonnement context (déclenche re-render sur highlight sidebar)
  const { setNodes, screenToFlowPosition, getNode } = useReactFlow();
  const dragStartRef = useRef<{ screenX: number; screenY: number; nodeX: number; nodeY: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={`px-3 py-2 rounded-lg shadow-md min-w-[90px] max-w-[260px] cursor-pointer transition-all hover:shadow-lg hover:scale-105 group ${
        isPortal ? 'border-2 border-dashed border-primary/40' : getPriorityBorder(item.priority)
      } ${isRoot ? 'shadow-lg' : ''} ${isHighlighted ? 'ring-4 ring-primary ring-offset-2 scale-110 z-10' : ''} ${isSearchMatch ? 'ring-4 ring-yellow-400 ring-offset-2 scale-110 z-10 shadow-lg' : ''} ${isDimmed ? 'opacity-30' : ''} ${isDropTarget ? 'ring-4 ring-blue-500 ring-offset-2 scale-110 shadow-xl border-blue-500' : ''} ${(() => { const v = (item as any).viewedAt; return (v === null || (v && new Date(item.updatedAt) > new Date(v))) && !isHighlighted && !isSearchMatch ? 'ring-2 ring-blue-400/70 animate-unseen-blink' : ''; })()}`}
      style={{ backgroundColor: hexColor, color: textColor }}
    >
      {/* Handles on all sides for radial connections */}
      <Handle type="target" position={Position.Top} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-2 !border-purple-600 hover:!bg-purple-500 hover:!scale-150 transition-transform" id="right-source" />

      {/* Grip — drag HTML5 : suit le curseur dans la mindmap + dépose sur un espace sidebar */}
      {canEdit && !isPortal && (
        <span
          draggable
          className="nodrag nopan absolute -top-2 -right-2 opacity-0 group-hover:opacity-70 hover:!opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded bg-black/20"
          title="Glisser pour repositionner ou déposer sur un espace"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            // Image ghost invisible — le node se déplace lui-même
            const ghost = document.createElement('div');
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            requestAnimationFrame(() => document.body.removeChild(ghost));

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-spok-item', JSON.stringify({ itemId: item.id, spaceId: (item as any).spaceId }));

            const node = getNode(item.id);
            dragStartRef.current = {
              screenX: e.clientX, screenY: e.clientY,
              nodeX: node?.position.x ?? 0, nodeY: node?.position.y ?? 0,
            };
            lastPosRef.current = null;
          }}
          onDrag={(e) => {
            // Un dragend/drag annulé (drop hors cible, ou geste tactile Chrome OS) renvoie
            // clientX/Y à 0 — et parfois NaN sur certains navigateurs : elementsFromPoint()
            // lève une exception sur une coordonnée non finie (vu en prod, Sentry, Chrome OS).
            const dragCancelled = !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || (e.clientX === 0 && e.clientY === 0);
            if (!dragStartRef.current || dragCancelled) return;
            const startFlow = screenToFlowPosition({ x: dragStartRef.current.screenX, y: dragStartRef.current.screenY });
            const currFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const newPos = {
              x: dragStartRef.current.nodeX + (currFlow.x - startFlow.x),
              y: dragStartRef.current.nodeY + (currFlow.y - startFlow.y),
            };
            lastPosRef.current = newPos;
            setNodes(nds => nds.map(n => n.id === item.id ? { ...n, position: newPos } : n));
          }}
          onDragEnd={(e) => {
            const pos = lastPosRef.current;
            dragStartRef.current = null;
            lastPosRef.current = null;
            if (!pos) return;
            // Si lâché sur la sidebar → le drop HTML5 a déjà géré le déplacement, ne pas sauvegarder
            const dragCancelled = !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || (e.clientX === 0 && e.clientY === 0);
            const isOnSidebar = !dragCancelled &&
              document.elementsFromPoint(e.clientX, e.clientY).some(el => !!(el as HTMLElement).dataset?.sidebarSpaceId);
            if (!isOnSidebar) {
              onSavePosition?.(item.id, pos);
            }
          }}
        >
          <GripVertical className="w-3 h-3" style={{ color: textColor }} />
        </span>
      )}

      <div className="flex items-center gap-2">
        {/* 1. Collapse/Expand button — shows child count badge when collapsed */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(item.id);
            }}
            className="flex items-center gap-1 px-1 py-0.5 hover:bg-black/10 rounded flex-shrink-0 nodrag nopan"
            title={isCollapsed ? 'Déplier' : 'Replier'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" style={{ color: textColor }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: textColor }} />
            )}
            {isCollapsed && childCount > 0 && (
              <span className="px-1 py-0 text-xs font-semibold rounded-full" style={{ backgroundColor: `${textColor}33`, color: textColor }}>
                {childCount}
              </span>
            )}
          </button>
        ) : null}

        {/* 2. Pin button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(item.id);
          }}
          className={`p-0.5 rounded flex-shrink-0 transition-opacity nodrag nopan ${isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          title={isPinned ? 'Désépingler (autoriser le repositionnement)' : 'Épingler (fixer la position)'}
        >
          {isPinned ? (
            <Pin className="w-3.5 h-3.5" style={{ color: textColor }} />
          ) : (
            <PinOff className="w-3.5 h-3.5 opacity-50" style={{ color: textColor }} />
          )}
        </button>

        {/* 3. Vignette commune, format ligne : miniature ou icône, titre, info principale, pastilles (couleur du nœud) */}
        <ItemVignette
          format="ligne"
          title={item.title}
          Icon={getTypeIcon(item.type)}
          color={textColor}
          face={itemFace(item, 'ligne', {
            type: item.type,
            status: item.status && item.status !== 'undefined' ? statusOptions.find((s) => s.id === item.status)?.label ?? null : null,
          })}
          titleClassName="font-medium"
        />

        {/* 6. Action menu */}
        <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity nodrag nopan">
          <ItemActionMenu
            groups={buildItemMenuGroups(item.id, {
              onEdit: canEdit ? onEdit : undefined,
              onDelete: canEdit ? onDelete : undefined,
              onUpdateStatus: canEdit ? onUpdateStatus : undefined,
              onAddChild: canEdit ? onAddChild : undefined,
              onMoveToSpace: canEdit ? onMoveToSpace : undefined,
              onDuplicateToSpace: canEdit ? onDuplicateToSpace : undefined,
              onConvertToSpace: canEdit ? onConvertToSpace : undefined,
              onSelfAssign,
              onMerge: canEdit ? onMerge : undefined,
              onAbsorbChildren: canEdit && hasChildItems(item) ? onAbsorbChildren : undefined,
              onSplitDescription: canEdit && hasHeadings(item.description) ? onSplitDescription : undefined,
              onOpen,
            onOpenInNewTab,
            }, { item: item,
              statusOptions: canEdit ? statusOptions : null,
              currentStatusId: item.status || undefined,
              extraChildren: [
                ...(hasPortalSupport && canEdit ? [{ id: 'add-portal', label: 'Ajouter un portail', icon: ExternalLink, onClick: () => onAddPortal(item.id) }] : []),
              ],
              extraOrganise: [
                ...(hasChildren && !isCollapsed ? [{ id: 'reorganize', label: 'Réorganiser les enfants', icon: RotateCcw, onClick: () => onReorganizeChildren(item.id) }] : []),
              ],
            })}
            triggerClassName="p-0.5 rounded hover:bg-black/10 transition-colors"
            side="right"
          />
        </div>
      </div>
    </div>
  );
}

// Space node component (central node)
interface SpaceNodeProps {
  data: {
    label: string;
    spaceName: string;
    itemCount: number;
    isDropTarget?: boolean;
  };
}

export function SpaceNode({ data }: SpaceNodeProps) {
  const { spaceName, itemCount, isDropTarget } = data;

  return (
    <div
      data-tour="mindmap-node"
      data-help-zone="mindmap:noeud"
      className={`px-6 py-3 rounded-xl shadow-lg border-3 border-primary bg-primary/10 min-w-[140px] cursor-default transition-all ${isDropTarget ? 'ring-3 ring-primary ring-offset-2 scale-110' : ''}`}
    >
      <Handle type="source" position={Position.Top} className="!bg-primary !w-3 !h-3" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-primary !w-3 !h-3" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" id="right-source" />

      <div className="flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-base font-bold text-primary">{spaceName}</span>
          <span className="text-xs text-muted-foreground">{itemCount} élément{itemCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// Portal node component (link to another space)
interface PortalNodeProps {
  data: {
    space: SpaceWithRole;
    onRemove: (portalId: string) => void;
    portalId: string;
    isChildSpace?: boolean;
    onReorganizeChildren?: (id: string) => void;
    hasItems?: boolean;
  };
}

export function PortalNode({ data }: PortalNodeProps) {
  const { space, onRemove, portalId, isChildSpace, onReorganizeChildren, hasItems } = data;

  const handleClick = () => {
    if (isChildSpace) {
      window.location.href = `/spaces/${space.id}`;
    } else {
      window.open(`/spaces/${space.id}`, '_blank');
    }
  };

  return (
    <div
      className={`px-4 py-3 rounded-xl shadow-lg border-2 min-w-[120px] cursor-pointer transition-all group ${
        isChildSpace
          ? 'border-solid border-indigo-500 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-600 hover:shadow-xl'
          : 'border-dashed border-indigo-400 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-500'
      }`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3" id="top" />
      <Handle type="target" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" id="bottom" />
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3" id="left" />
      <Handle type="target" position={Position.Right} className="!bg-indigo-400 !w-3 !h-3" id="right" />

      <Handle type="source" position={Position.Top} className="!bg-indigo-400 !w-3 !h-3" id="top-source" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" id="bottom-source" />
      <Handle type="source" position={Position.Left} className="!bg-indigo-400 !w-3 !h-3" id="left-source" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-400 !w-3 !h-3" id="right-source" />

      <div className="flex items-center gap-2">
        {isChildSpace ? (
          <FolderOpen className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        ) : (
          <ExternalLink className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-indigo-700">{space.name}</span>
          <span className="text-xs text-indigo-500">
            {isChildSpace ? 'Sous-espace' : 'Portail'}
          </span>
        </div>
      </div>

      {/* Action buttons on hover */}
      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasItems && onReorganizeChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReorganizeChildren(portalId);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-indigo-50"
            title="Réorganiser les enfants"
          >
            <RotateCcw className="w-3 h-3 text-indigo-500" />
          </button>
        )}
        {!isChildSpace && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(portalId);
            }}
            className="p-1 bg-white rounded-full shadow-md hover:bg-red-50"
            title="Supprimer le portail"
          >
            <X className="w-3 h-3 text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

// Node type registry for ReactFlow
export const nodeTypes = {
  mindmap: MindMapNode,
  space: SpaceNode,
  portal: PortalNode,
};

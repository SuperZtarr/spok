import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from '@xyflow/react';
import type { SpaceWithRole } from '@spok/shared';
import { getTypeIcon, getPriorityConfig } from '../../constants/ui';

// Border thickness + color based on priority (higher priority = thicker)
function getPriorityBorder(priority: number | null | undefined): string {
  const cfg = getPriorityConfig(priority);
  const color = cfg ? cfg.color : 'border-gray-300';
  const thickness = cfg
    ? (cfg.value === 4 ? 'border-4' : cfg.value === 3 ? 'border-[3px]' : cfg.value === 2 ? 'border-2' : 'border')
    : 'border-2';
  return `${thickness} ${color}`;
}
import { ChevronRight, ChevronDown, FolderOpen, RotateCcw, ExternalLink, X, Pin, PinOff } from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import type { TreeItem } from './mindmap-utils';

function FaviconImg({ src, domain, fallbackColor }: { src: string; domain: string; fallbackColor: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const initial = domain.replace(/^www\./, '')[0]?.toUpperCase() ?? '?';
    return (
      <span
        className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold leading-none"
        style={{ backgroundColor: `${fallbackColor}33`, color: fallbackColor }}
      >
        {initial}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-4 h-4 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function ItemIllustration({ item, textColor }: { item: TreeItem; textColor: string }) {
  const url = item.url;
  if (!url) return null;

  // Image : type IMAGE/DIAGRAM ou extension image
  if (item.type === 'IMAGE' || item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return <ImageThumbnail url={url} />;
  }

  // Lien : favicon du site
  if (item.type === 'LINK') {
    let domain = '';
    try { domain = new URL(url).hostname; } catch { /* url invalide */ }
    const faviconUrl = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '';
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 nodrag nopan"
        title={url}
      >
        {faviconUrl ? (
          <FaviconImg src={faviconUrl} domain={domain} fallbackColor={textColor} />
        ) : (
          <ExternalLink className="w-4 h-4" style={{ color: textColor }} />
        )}
      </a>
    );
  }

  // Réunion : date de la réunion
  if (item.type === 'MEETING' && item.startDate) {
    const d = new Date(item.startDate);
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return (
      <span className="flex-shrink-0 text-xs font-medium px-1 py-0.5 rounded" style={{ backgroundColor: `${textColor}22`, color: textColor }}>
        {label}
      </span>
    );
  }

  // Document : icône du type de fichier (PDF, Word, Excel…) avec lien vers le doc
  if (item.type === 'DOCUMENT') {
    const DocIcon = getTypeIcon(item.type, url);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 p-0.5 hover:bg-black/10 rounded nodrag nopan"
        title={url}
      >
        <DocIcon className="w-3.5 h-3.5" style={{ color: textColor }} />
      </a>
    );
  }

  return null;
}

function ImageThumbnail({ url }: { url: string }) {
  const [hover, setHover] = useState(false);
  const thumbRef = useRef<HTMLDivElement>(null);

  const positionPopup = useCallback((popup: HTMLDivElement | null) => {
    if (!popup || !thumbRef.current) return;
    // Wait for image to have dimensions
    const img = popup.querySelector('img');
    const doPosition = () => {
      const thumb = thumbRef.current!.getBoundingClientRect();
      const pw = popup.offsetWidth;
      const ph = popup.offsetHeight;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let x = thumb.left + thumb.width / 2 - pw / 2;
      let y = thumb.top - ph - margin;

      if (y < margin) y = thumb.bottom + margin;
      if (y + ph > vh - margin) y = vh - margin - ph;
      if (x + pw > vw - margin) x = vw - margin - pw;
      if (x < margin) x = margin;

      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
      popup.style.visibility = 'visible';
    };
    if (img && img.complete) {
      doPosition();
    } else if (img) {
      img.onload = doPosition;
    }
  }, []);

  return (
    <div
      ref={thumbRef}
      className="flex-shrink-0 nodrag nopan"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img src={url} alt="" className="w-6 h-6 object-cover rounded border border-border cursor-zoom-in" />
      {hover && createPortal(
        <div
          ref={positionPopup}
          className="fixed z-[9999] p-1 bg-white rounded-lg shadow-2xl border border-border pointer-events-none"
          style={{ visibility: 'hidden' }}
        >
          <img src={url} alt="" className="max-w-[500px] max-h-[500px] object-contain rounded" />
        </div>,
        document.body
      )}
    </div>
  );
}

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
    onOpenInNewTab?: (id: string) => void;
    doneStatusId: string;
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
    isPortal: boolean;
    portalSpaceName?: string;
  };
}

export function MindMapNode({ data }: MindMapNodeProps) {
  const { item, hexColor, textColor, onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, doneStatusId, isRoot, hasChildren, isCollapsed, childCount, hasPortalSupport, isHighlighted, isDimmed, isSearchMatch, isDropTarget, canEdit, isPinned, onTogglePin, isPortal, portalSpaceName: _portalSpaceName } = data;
  const Icon = getTypeIcon(item.type, item.url);

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

        {/* 2. Type icon */}
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: textColor }} />

        {/* 3. Pin button */}
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

        {/* 4. Title */}
        <span className="text-sm font-medium line-clamp-2 break-words" title={item.title}>{item.title}</span>

        {/* 5. Illustration */}
        <ItemIllustration item={item} textColor={textColor} />

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
              onAbsorbChildren: canEdit ? onAbsorbChildren : undefined,
              onSplitDescription: canEdit && hasHeadings(item.description) ? onSplitDescription : undefined,
              onOpenInNewTab,
            }, {
              statusAction: canEdit && item.status !== doneStatusId ? { label: 'Marquer terminé', statusId: doneStatusId } : null,
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

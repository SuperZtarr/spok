import { useMemo, useState, useCallback, useEffect } from 'react';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { ImageIcon, ChevronLeft, ChevronRight, X, FolderKanban, GripVertical, ZoomIn, ZoomOut, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';

const ZOOM_LEVELS = [
  { cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10', label: 'XS' },
  { cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8', label: 'S' },
  { cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6', label: 'M' },
  { cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', label: 'L' },
  { cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4', label: 'XL' },
  { cols: 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3', label: 'XXL' },
] as const;

interface ImageItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  status: string | null;
  parentId: string | null;
  createdById?: string;
}

interface ImageGroup {
  parentId: string | null;
  parentTitle: string;
  images: ImageItem[];
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

function Lightbox({ images, index, onClose, onNavigate }: {
  images: ImageItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, images.length, onClose, onNavigate]);

  const img = images[index];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
        <X className="w-8 h-8" />
      </button>

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={img.url}
          alt={img.title}
          className="max-w-full max-h-[80vh] object-contain rounded"
        />
        <div className="mt-3 text-center">
          <p className="text-white font-medium">{img.title}</p>
          <p className="text-white/50 text-sm">{index + 1}/{images.length}</p>
        </div>
      </div>
    </div>
  );
}

function DraggableImage({ id, children, canDrag }: { id: string; children: React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canDrag });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 50 : undefined } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={`group/drag relative ${isDragging ? 'opacity-60 shadow-lg' : ''}`}>
      {canDrag && (
        <div {...attributes} {...listeners} className="absolute top-1 left-1 z-10 p-0.5 rounded bg-black/40 hover:bg-black/60 text-white cursor-grab opacity-0 group-hover/drag:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppableGroup({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: dropping } = useDroppable({ id });
  const highlight = isOver !== undefined ? isOver : dropping;
  return (
    <div ref={setNodeRef} className={`border border-border rounded-lg bg-card transition-colors ${highlight ? 'border-primary bg-primary/5' : ''}`}>
      {children}
    </div>
  );
}

interface ImagesViewProps {
  items: Item[] | undefined;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  referentiels?: any;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  portalGroups?: PortalGroup[];
  currentSpaceId?: string;
  onNewItem?: () => void;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function ImagesView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen,
            onOpenInNewTab, onMove, referentiels, canEdit = true, canEditItem, portalGroups, currentSpaceId: _currentSpaceId,
            onNewItem, spaceName, viewContainerRef, onStartTour, pulseHelp }: ImagesViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(2); // default M
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const gridCols = ZOOM_LEVELS[zoomLevel].cols;

  const images = useMemo<ImageItem[]>(() => {
    if (!items) return [];
    return items
      .filter(item => item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url))
      .map(item => ({
        id: item.id,
        title: item.title,
        url: item.url!,
        description: item.description || null,
        status: item.status || null,
        parentId: item.parentId || null,
        createdById: item.createdById,
      }));
  }, [items]);

  // Group images by parent
  const groups = useMemo<ImageGroup[]>(() => {
    const parentNames: Record<string, string> = {};
    if (items) {
      for (const item of items) {
        parentNames[item.id] = item.title;
      }
    }
    const groupMap = new Map<string | null, ImageItem[]>();
    for (const img of images) {
      const key = img.parentId;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(img);
    }
    // Root group first, then sorted by parent name
    const result: ImageGroup[] = [];
    const rootImages = groupMap.get(null);
    if (rootImages) result.push({ parentId: null, parentTitle: 'Sans parent', images: rootImages });
    for (const [parentId, imgs] of groupMap) {
      if (parentId === null) continue;
      result.push({ parentId, parentTitle: parentNames[parentId] || 'Parent inconnu', images: imgs });
    }
    return result;
  }, [images, items]);

  // Flat list for lightbox navigation
  const flatImages = useMemo(() => groups.flatMap(g => g.images), [groups]);

  const statusOptions = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return (statuses as Array<{ id: string; label: string; visible: boolean; order: number }>).filter(s => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !onMove) return;
    const itemId = active.id as string;
    // Droppable IDs are "group:<parentId>" or "group:__root__"
    const dropId = over.id as string;
    if (!dropId.startsWith('group:')) return;
    const newParentId = dropId === 'group:__root__' ? null : dropId.replace('group:', '');
    // Find current parentId of the dragged item
    const img = images.find(i => i.id === itemId);
    if (!img || img.parentId === newParentId) return;
    // Position at end of target group
    const targetGroup = groups.find(g => g.parentId === newParentId);
    const position = targetGroup ? targetGroup.images.length : 0;
    onMove(itemId, newParentId, position);
  }, [onMove, images, groups]);

  // Get flat index for lightbox from group image
  const getFlatIndex = useCallback((img: ImageItem) => {
    return flatImages.findIndex(fi => fi.id === img.id);
  }, [flatImages]);

  const header = (
    <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {canEdit && onNewItem && (
        <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          + Nouveau
        </button>
      )}
      <div className="flex-1" />
      <ViewHelpButton viewMode="images" onStartTour={onStartTour} pulse={pulseHelp} />
      {spaceName && viewContainerRef && (
        <SpaceExportButton items={items ?? []} spaceName={spaceName} viewMode="images" viewContainerRef={viewContainerRef} />
      )}
    </div>
  );

  if (images.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucune image</p>
            <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item avec une image.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Zoom controls */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-2 py-1">
          <button
            onClick={() => setZoomLevel(z => Math.max(0, z - 1))}
            disabled={zoomLevel === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            title="Réduire"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={0}
            max={ZOOM_LEVELS.length - 1}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-24 h-1.5 accent-primary cursor-pointer"
          />
          <button
            onClick={() => setZoomLevel(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
            disabled={zoomLevel === ZOOM_LEVELS.length - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            title="Agrandir"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground w-6 text-center">{ZOOM_LEVELS[zoomLevel].label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{images.length} image{images.length > 1 ? 's' : ''}</span>
      </div>

      {groups.map((group) => {
        const groupKey = group.parentId ?? '__root__';
        const isCollapsed = collapsedGroups.has(groupKey);
        return (
        <DroppableGroup key={groupKey} id={`group:${groupKey}`}>
          {/* Group header — click chevron to collapse, click title to open parent */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg">
            <button
              onClick={() => toggleGroup(groupKey)}
              className="p-0.5 rounded hover:bg-black/10 flex-shrink-0 transition-transform"
            >
              <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span
              className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => group.parentId && onEdit?.(group.parentId)}
            >
              {group.parentTitle}
            </span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{group.images.length}</span>
          </div>

          {!isCollapsed && (
          <div className="p-3">
            <div className={`grid ${gridCols} gap-3`}>
              {group.images.map((img) => {
                return (
                  <DraggableImage key={img.id} id={img.id} canDrag={canEdit && !!onMove}>
                  <div
                    className="group relative flex flex-col rounded-lg overflow-hidden border bg-card hover:shadow-md hover:border-primary/30 transition-all"
                  >
                    <button
                      onClick={() => openLightbox(getFlatIndex(img))}
                      onDoubleClick={() => onEdit?.(img.id)}
                      className="flex-1 flex flex-col"
                    >
                      <div className="aspect-square overflow-hidden bg-muted">
                        <img
                          src={img.url}
                          alt={img.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                      </div>
                      <div className="px-2 py-1.5 min-h-[2.5rem]">
                        <p className="text-xs font-medium truncate">{img.title}</p>
                      </div>
                    </button>

                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ItemActionMenu
                        groups={buildItemMenuGroups(img.id, { onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription: hasHeadings(img.description) ? onSplitDescription : undefined, onOpen,
            onOpenInNewTab }, { canEdit: canEditItem ? canEditItem(img) : canEdit, statusOptions, currentStatusId: img.status || undefined })}
                        triggerClassName="p-1 rounded bg-black/40 hover:bg-black/60 text-white transition-colors"
                      />
                    </div>
                  </div>
                  </DraggableImage>
                );
              })}
            </div>
          </div>
          )}
        </DroppableGroup>
        );
      })}

      {/* Portal sections for child spaces */}
      {portalGroups?.map(group => {
        const portalImages = group.items
          .filter(item => item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url))
          .map(item => ({
            id: item.id,
            title: item.title,
            url: item.url!,
            description: item.description || null,
            status: item.status || null,
            parentId: item.parentId || null,
          }));
        if (portalImages.length === 0) return null;
        // Group portal images by parent
        const portalParentNames: Record<string, string> = {};
        for (const item of group.items) portalParentNames[item.id] = item.title;
        const portalGroupMap = new Map<string | null, ImageItem[]>();
        for (const img of portalImages) {
          const key = img.parentId;
          if (!portalGroupMap.has(key)) portalGroupMap.set(key, []);
          portalGroupMap.get(key)!.push(img);
        }
        const portalImageGroups: ImageGroup[] = [];
        const rootImgs = portalGroupMap.get(null);
        if (rootImgs) portalImageGroups.push({ parentId: null, parentTitle: 'Sans parent', images: rootImgs });
        for (const [parentId, imgs] of portalGroupMap) {
          if (parentId === null) continue;
          portalImageGroups.push({ parentId, parentTitle: portalParentNames[parentId] || 'Parent inconnu', images: imgs });
        }
        return (
          <div key={`portal-${group.spaceId}`} className="mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 text-sm font-medium text-muted-foreground mb-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{group.spaceName}</span>
              <span className="text-xs text-muted-foreground/60">({portalImages.length})</span>
            </div>
            {portalImageGroups.map((pGroup) => (
              <div key={pGroup.parentId ?? '__root__'} className="border border-border rounded-lg bg-card mb-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => pGroup.parentId && onEdit?.(pGroup.parentId)}
                >
                  <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{pGroup.parentTitle}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{pGroup.images.length}</span>
                </div>
                <div className="p-3">
                  <div className={`grid ${gridCols} gap-3`}>
                    {pGroup.images.map((img) => (
                      <div
                        key={img.id}
                        className="group relative flex flex-col rounded-lg overflow-hidden border bg-card hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <button
                          onClick={() => onEdit?.(img.id)}
                          className="flex-1 flex flex-col"
                        >
                          <div className="aspect-square overflow-hidden bg-muted">
                            <img
                              src={img.url}
                              alt={img.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-2 py-1.5 min-h-[2.5rem]">
                            <p className="text-xs font-medium truncate">{img.title}</p>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {lightboxIndex !== null && flatImages.length > 0 && (
        <Lightbox
          images={flatImages}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
    </DndContext>
    </div>
  );
}

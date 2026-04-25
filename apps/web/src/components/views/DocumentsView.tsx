import { useMemo, useCallback } from 'react';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { FileText, Download, FolderKanban, GripVertical } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { getTypeIcon } from '../../constants/ui';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';

function getFileIcon(url: string) {
  return getTypeIcon('DOCUMENT', url);
}

function getFileExtension(url: string): string {
  const parts = url.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
}

function DraggableDoc({ id, children, canDrag }: { id: string; children: React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canDrag });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 50 : undefined } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={`group/drag relative ${isDragging ? 'opacity-60 shadow-lg' : ''}`}>
      {canDrag && (
        <div {...attributes} {...listeners} className="absolute top-2 left-2 z-10 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab opacity-0 group-hover/drag:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppableDocGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`border border-border rounded-lg bg-card transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}>
      {children}
    </div>
  );
}

interface DocGroup {
  parentId: string | null;
  parentTitle: string;
  docs: Item[];
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface DocumentsViewProps {
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
  onOpenInNewTab?: (id: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  referentiels?: any;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  portalGroups?: PortalGroup[];
  currentSpaceId?: string;
}

export function DocumentsView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, onMove, referentiels, canEdit = true, canEditItem, portalGroups, currentSpaceId: _currentSpaceId }: DocumentsViewProps) {
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const documents = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'DOCUMENT' && item.url);
  }, [items]);

  const groups = useMemo<DocGroup[]>(() => {
    const parentNames: Record<string, string> = {};
    if (items) {
      for (const item of items) parentNames[item.id] = item.title;
    }
    const groupMap = new Map<string | null, Item[]>();
    for (const doc of documents) {
      const key = doc.parentId || null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(doc);
    }
    const result: DocGroup[] = [];
    const rootDocs = groupMap.get(null);
    if (rootDocs) result.push({ parentId: null, parentTitle: 'Sans parent', docs: rootDocs });
    for (const [parentId, docs] of groupMap) {
      if (parentId === null) continue;
      result.push({ parentId, parentTitle: parentNames[parentId] || 'Parent inconnu', docs });
    }
    return result;
  }, [documents, items]);

  const doneStatusId = referentiels?.statusLabels
    ? Object.entries(referentiels.statusLabels).find(([, v]: any) => v.label === 'Terminé')?.[0] || 'done'
    : 'done';

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !onMove) return;
    const itemId = active.id as string;
    const dropId = over.id as string;
    if (!dropId.startsWith('group:')) return;
    const newParentId = dropId === 'group:__root__' ? null : dropId.replace('group:', '');
    const doc = documents.find(d => d.id === itemId);
    if (!doc || (doc.parentId || null) === newParentId) return;
    const targetGroup = groups.find(g => g.parentId === newParentId);
    const position = targetGroup ? targetGroup.docs.length : 0;
    onMove(itemId, newParentId, position);
  }, [onMove, documents, groups]);

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucun document</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item de type DOCUMENT.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {groups.map((group) => (
        <DroppableDocGroup key={group.parentId ?? '__root__'} id={`group:${group.parentId ?? '__root__'}`}>
          <div
            className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
            onClick={() => group.parentId && onEdit?.(group.parentId)}
          >
            <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{group.parentTitle}</span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{group.docs.length}</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.docs.map(doc => {
                const Icon = getFileIcon(doc.url!);
                const ext = getFileExtension(doc.url!);
                const isDone = doc.status === doneStatusId || doc.status === 'done';
                return (
                  <DraggableDoc key={doc.id} id={doc.id} canDrag={canEdit && !!onMove}>
                  <div
                    className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                    onClick={() => onEdit?.(doc.id)}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                      )}
                      {ext && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
                          {ext}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={doc.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Telecharger"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <ItemActionMenu
                          groups={buildItemMenuGroups(doc.id, { onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription: hasHeadings(doc.description) ? onSplitDescription : undefined, onOpenInNewTab }, { canEdit: canEditItem ? canEditItem(doc) : canEdit, statusAction: !isDone ? { label: 'Marquer terminé', statusId: doneStatusId } : null })}
                        />
                      </div>
                    </div>
                  </div>
                  </DraggableDoc>
                );
              })}
            </div>
          </div>
        </DroppableDocGroup>
      ))}

      {/* Portal sections for child spaces */}
      {portalGroups?.map(group => {
        const portalDocs = group.items.filter(item => item.type === 'DOCUMENT' && item.url);
        if (portalDocs.length === 0) return null;
        // Group portal docs by parent
        const portalParentNames: Record<string, string> = {};
        for (const item of group.items) portalParentNames[item.id] = item.title;
        const portalGroupMap = new Map<string | null, Item[]>();
        for (const doc of portalDocs) {
          const key = doc.parentId || null;
          if (!portalGroupMap.has(key)) portalGroupMap.set(key, []);
          portalGroupMap.get(key)!.push(doc);
        }
        const portalDocGroups: DocGroup[] = [];
        const rootDocs = portalGroupMap.get(null);
        if (rootDocs) portalDocGroups.push({ parentId: null, parentTitle: 'Sans parent', docs: rootDocs });
        for (const [parentId, docs] of portalGroupMap) {
          if (parentId === null) continue;
          portalDocGroups.push({ parentId, parentTitle: portalParentNames[parentId] || 'Parent inconnu', docs });
        }
        return (
          <div key={`portal-${group.spaceId}`} className="mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 text-sm font-medium text-muted-foreground mb-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{group.spaceName}</span>
              <span className="text-xs text-muted-foreground/60">({portalDocs.length})</span>
            </div>
            {portalDocGroups.map((pGroup) => (
              <div key={pGroup.parentId ?? '__root__'} className="border border-border rounded-lg bg-card mb-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => pGroup.parentId && onEdit?.(pGroup.parentId)}
                >
                  <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{pGroup.parentTitle}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{pGroup.docs.length}</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {pGroup.docs.map(doc => {
                      const Icon = getFileIcon(doc.url!);
                      const ext = getFileExtension(doc.url!);
                      return (
                        <div
                          key={doc.id}
                          className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                          onClick={() => onEdit?.(doc.id)}
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                            )}
                            {ext && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
                                {ext}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={doc.url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Telecharger"
                            >
                              <Download className="w-4 h-4 text-muted-foreground" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
    </DndContext>
  );
}

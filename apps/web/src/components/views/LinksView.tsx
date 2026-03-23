import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { ExternalLink, FolderKanban, Trash2, Plus, FolderInput, FolderPlus, Copy, UserPlus, Merge, ArrowDownToLine, CheckSquare, GripVertical, Pencil } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { RoleGuard } from '../RoleGuard';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
}

function LinkTag({ item, onEdit, actions, canEdit, referentiels }: {
  item: Item;
  onEdit?: (id: string) => void;
  actions: LinkActions;
  canEdit: boolean;
  referentiels?: any;
}) {
  const { data: meta } = useQuery<UrlMeta>({
    queryKey: ['url-meta', item.url],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/url-meta?url=${encodeURIComponent(item.url!)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { title: null, description: null, favicon: null };
      return res.json();
    },
    enabled: !!item.url,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const displayTitle = item.title || meta?.title || item.url;
  const tooltip = [meta?.description || item.description, item.url].filter(Boolean).join('\n');
  const faviconUrl = meta?.favicon;

  const doneStatusId = referentiels?.statusLabels
    ? Object.entries(referentiels.statusLabels).find(([, v]: any) => v.label === 'Terminé')?.[0] || 'done'
    : 'done';
  const isDone = item.status === doneStatusId || item.status === 'done';

  return (
    <div className="inline-flex items-center group/link relative">
      <a
        href={item.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-full hover:bg-accent hover:border-primary/30 transition-colors shadow-sm"
        title={tooltip}
        onDoubleClick={(e) => { e.preventDefault(); onEdit?.(item.id); }}
      >
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="w-6 h-6 rounded flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <ExternalLink className="w-5 h-5 text-primary flex-shrink-0" />
        )}
        <span className="truncate max-w-[250px]">{displayTitle}</span>
      </a>

      {canEdit && actions.onDelete && (
        <div className="ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">
          <RoleGuard role="MEMBER">
            <ItemActionMenu
              groups={[
                {
                  actions: [
                    ...(onEdit ? [{ id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(item.id) }] : []),
                    ...(actions.onUpdateStatus && !isDone ? [{ id: 'done', label: 'Marquer terminé', icon: CheckSquare, onClick: () => actions.onUpdateStatus!(item.id, doneStatusId) }] : []),
                    ...(actions.onAddChild ? [{ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => actions.onAddChild!(item.id) }] : []),
                    ...(actions.onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => actions.onSelfAssign!(item.id) }] : []),
                    ...(actions.onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => actions.onMerge!(item.id) }] : []),
                    ...(actions.onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => actions.onAbsorbChildren!(item.id) }] : []),
                    ...(actions.onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: () => actions.onDuplicateToSpace!(item.id) }] : []),
                  ],
                },
                {
                  actions: [
                    ...(actions.onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => actions.onMoveToSpace!(item.id) }] : []),
                    ...(actions.onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => actions.onConvertToSpace!(item.id) }] : []),
                  ],
                },
                {
                  actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => actions.onDelete!(item.id), variant: 'danger' as const }],
                },
              ].filter(g => g.actions.length > 0)}
            />
          </RoleGuard>
        </div>
      )}
    </div>
  );
}

function DraggableLink({ id, children, canDrag }: { id: string; children: React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canDrag });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 50 : undefined } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={`group/drag inline-flex items-center ${isDragging ? 'opacity-60 shadow-lg' : ''}`}>
      {canDrag && (
        <div {...attributes} {...listeners} className="p-0.5 mr-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab opacity-0 group-hover/drag:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppableLinkGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`border border-border rounded-lg bg-card transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}>
      {children}
    </div>
  );
}

interface LinkActions {
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
}

interface LinkGroup {
  parentId: string | null;
  parentTitle: string;
  links: Item[];
}

interface LinksViewProps {
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
  onMove?: (id: string, parentId: string | null, position: number) => void;
  referentiels?: any;
  canEdit?: boolean;
}

export function LinksView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onMove, referentiels, canEdit = true }: LinksViewProps) {
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const links = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'LINK' && item.url);
  }, [items]);

  const groups = useMemo<LinkGroup[]>(() => {
    const parentNames: Record<string, string> = {};
    if (items) {
      for (const item of items) parentNames[item.id] = item.title;
    }
    const groupMap = new Map<string | null, Item[]>();
    for (const link of links) {
      const key = link.parentId || null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(link);
    }
    const result: LinkGroup[] = [];
    const rootLinks = groupMap.get(null);
    if (rootLinks) result.push({ parentId: null, parentTitle: 'Sans parent', links: rootLinks });
    for (const [parentId, items] of groupMap) {
      if (parentId === null) continue;
      result.push({ parentId, parentTitle: parentNames[parentId] || 'Parent inconnu', links: items });
    }
    return result;
  }, [links, items]);

  const actions: LinkActions = { onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !onMove) return;
    const itemId = active.id as string;
    const dropId = over.id as string;
    if (!dropId.startsWith('group:')) return;
    const newParentId = dropId === 'group:__root__' ? null : dropId.replace('group:', '');
    const link = links.find(l => l.id === itemId);
    if (!link || (link.parentId || null) === newParentId) return;
    const targetGroup = groups.find(g => g.parentId === newParentId);
    const position = targetGroup ? targetGroup.links.length : 0;
    onMove(itemId, newParentId, position);
  }, [onMove, links, groups]);

  if (links.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucun lien</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item de type LINK.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {groups.map((group) => (
        <DroppableLinkGroup key={group.parentId ?? '__root__'} id={`group:${group.parentId ?? '__root__'}`}>
          <div
            className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
            onClick={() => group.parentId && onEdit?.(group.parentId)}
          >
            <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{group.parentTitle}</span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{group.links.length}</span>
          </div>
          <div className="p-3">
            <div className="flex flex-wrap gap-2">
              {group.links.map(link => (
                <DraggableLink key={link.id} id={link.id} canDrag={canEdit && !!onMove}>
                  <LinkTag item={link} onEdit={onEdit} actions={actions} canEdit={canEdit} referentiels={referentiels} />
                </DraggableLink>
              ))}
            </div>
          </div>
        </DroppableLinkGroup>
      ))}
    </div>
    </DndContext>
  );
}

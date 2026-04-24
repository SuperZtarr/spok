import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { ExternalLink, FolderKanban, GripVertical } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { RoleGuard } from '../RoleGuard';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
}

function LinkTag({ item, onEdit, actions, canEdit, canEditItem, referentiels }: {
  item: Item;
  onEdit?: (id: string) => void;
  actions: LinkActions;
  canEdit: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
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

      {(canEditItem ? canEditItem(item) : canEdit) && actions.onDelete && (
        <div className="ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity">
          <RoleGuard role="MEMBER">
            <ItemActionMenu
              groups={buildItemMenuGroups(item.id, { onEdit, onDelete: actions.onDelete, onUpdateStatus: actions.onUpdateStatus, onAddChild: actions.onAddChild, onMoveToSpace: actions.onMoveToSpace, onDuplicateToSpace: actions.onDuplicateToSpace, onConvertToSpace: actions.onConvertToSpace, onSelfAssign: actions.onSelfAssign, onMerge: actions.onMerge, onAbsorbChildren: actions.onAbsorbChildren, onSplitDescription: hasHeadings(item.description) ? actions.onSplitDescription : undefined, onOpenInNewTab: actions.onOpenInNewTab }, { statusAction: !isDone ? { label: 'Marquer terminé', statusId: doneStatusId } : null })}
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
  onSplitDescription?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
}

interface LinkGroup {
  parentId: string | null;
  parentTitle: string;
  links: Item[];
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
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
  onSplitDescription?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  referentiels?: any;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  portalGroups?: PortalGroup[];
  currentSpaceId?: string;
}

export function LinksView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, onMove, referentiels, canEdit = true, canEditItem, portalGroups, currentSpaceId: _currentSpaceId }: LinksViewProps) {
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

  const actions: LinkActions = { onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab };

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
                  <LinkTag item={link} onEdit={onEdit} actions={actions} canEdit={canEdit} canEditItem={canEditItem} referentiels={referentiels} />
                </DraggableLink>
              ))}
            </div>
          </div>
        </DroppableLinkGroup>
      ))}

      {/* Portal sections for child spaces */}
      {portalGroups?.map(group => {
        const portalLinks = group.items.filter(item => item.type === 'LINK' && item.url);
        if (portalLinks.length === 0) return null;
        // Group portal links by parent
        const portalParentNames: Record<string, string> = {};
        for (const item of group.items) portalParentNames[item.id] = item.title;
        const portalGroupMap = new Map<string | null, Item[]>();
        for (const link of portalLinks) {
          const key = link.parentId || null;
          if (!portalGroupMap.has(key)) portalGroupMap.set(key, []);
          portalGroupMap.get(key)!.push(link);
        }
        const portalLinkGroups: LinkGroup[] = [];
        const rootLinks = portalGroupMap.get(null);
        if (rootLinks) portalLinkGroups.push({ parentId: null, parentTitle: 'Sans parent', links: rootLinks });
        for (const [parentId, pLinks] of portalGroupMap) {
          if (parentId === null) continue;
          portalLinkGroups.push({ parentId, parentTitle: portalParentNames[parentId] || 'Parent inconnu', links: pLinks });
        }
        return (
          <div key={`portal-${group.spaceId}`} className="mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 text-sm font-medium text-muted-foreground mb-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{group.spaceName}</span>
              <span className="text-xs text-muted-foreground/60">({portalLinks.length})</span>
            </div>
            {portalLinkGroups.map((pGroup) => (
              <div key={pGroup.parentId ?? '__root__'} className="border border-border rounded-lg bg-card mb-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => pGroup.parentId && onEdit?.(pGroup.parentId)}
                >
                  <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{pGroup.parentTitle}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{pGroup.links.length}</span>
                </div>
                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {pGroup.links.map(link => (
                      <LinkTag key={link.id} item={link} onEdit={onEdit} actions={actions} canEdit={false} referentiels={referentiels} />
                    ))}
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

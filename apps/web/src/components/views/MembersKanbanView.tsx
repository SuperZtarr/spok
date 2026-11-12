/* Vue Assignations : kanban par membre (colonnes = membres de l'espace). Icône œil barré sur une carte
 * quand l'assigné n'a pas encore ouvert l'item depuis son assignation (assignmentReceipt, 2026-09-29).
 * Visiteur non connecté : l'API ne donne pas la liste des membres (règle members-email-scope), les colonnes sont
 * alors les personnes assignées aux éléments affichés (assigneesFromItems), plus « Non assigné ».
 * Noms saisis librement (assignedToName, personne sans compte, 2026-11-12) : une colonne « sans compte » par nom, après
 * les membres, même si un membre porte le même nom (décision Thomas : deux colonnes). Deux saisies ne différant que par
 * la casse ou les espaces vont dans la même colonne (freeNameKey) ; les accents comptent. Déposer une carte sur une
 * colonne de nom libre enregistre ce nom (sans notification) ; sur « Non assigné », efface membre ET nom. */
import { useState, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
} from '@dnd-kit/core';
import { GripVertical, User, Users, UserRound, FolderKanban, GripHorizontal, EyeOff } from 'lucide-react';
import type { Item, ItemWithRelations, SpaceReferentiels } from '@spok/shared';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import { spacesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { getTypeIcon, getTypeTextColor, getPriorityConfig } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';
import { TagBadge } from '../ui/TagBadge';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings, hasChildItems } from '../../lib/itemMenuGroups';
import { EmptyHelp } from '../../help/EmptyHelp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberColumn {
  id: string;       // 'spaceId::member-<userId>', 'spaceId::name-<freeNameKey>' or 'spaceId::member-unassigned'
  userId: string | null;
  name: string;
  /** Nom saisi librement que la colonne représente (personne sans compte) ; absent pour un membre et « Non assigné ». */
  freeName?: string;
}

/** Clé de regroupement d'un nom libre : casse et espaces (début, fin, doublés) ignorés ; les accents comptent, comme la fiche. */
export function freeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Noms saisis librement sur les éléments sans membre assigné, un par clé (première orthographe rencontrée), triés par nom. */
export function freeNamesFromItems(items: Pick<Item, 'assignedToId' | 'assignedToName'>[]): { key: string; name: string }[] {
  const byKey = new Map<string, string>();
  for (const item of items) {
    if (item.assignedToId || !item.assignedToName?.trim()) continue;
    const key = freeNameKey(item.assignedToName);
    if (!byKey.has(key)) byKey.set(key, item.assignedToName.trim().replace(/\s+/g, ' '));
  }
  return Array.from(byKey, ([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Colonne d'un élément dans une section d'espace : membre, nom libre ou « Non assigné ». */
function columnIdOf(item: Pick<Item, 'assignedToId' | 'assignedToName'>, sid: string): string {
  if (item.assignedToId) return `${sid}::member-${item.assignedToId}`;
  if (item.assignedToName?.trim()) return `${sid}::name-${freeNameKey(item.assignedToName)}`;
  return `${sid}::member-unassigned`;
}

/** Personnes assignées aux éléments, triées par nom : colonnes de la vue pour un visiteur, qui n'a pas la liste des membres. */
export function assigneesFromItems(items: Pick<ItemWithRelations, 'assignedTo'>[]): { userId: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const item of items) {
    if (item.assignedTo) byId.set(item.assignedTo.id, item.assignedTo.name);
  }
  return Array.from(byId, ([userId, name]) => ({ userId, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
}

interface MembersKanbanViewProps {
  items: Item[];
  spaceId: string;
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** assignedToName : nom libre à enregistrer (colonne « sans compte »), null pour l'effacer (« Non assigné »), absent pour un membre. */
  onUpdateAssignee: (id: string, assignedToId: string | null, assignedToName?: string | null) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  spaceRole?: string;
  exportSpaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

const MIN_BOARD_HEIGHT = 200;
const DEFAULT_BOARD_HEIGHT = 400;

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function MemberKanbanCard({
  item,
  onEdit,
  onDelete,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onConvertToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen, onOpenInNewTab,
  isDragging,
  canEdit = true,
  canEditItem,
  referentiels,
}: {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
  isDragging?: boolean;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels;
}) {
  const Icon = getTypeIcon(item.type);
  const pConfig = getPriorityConfig(item.priority);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div data-help-zone="members:carte"
      ref={setNodeRef}
      style={style}
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(item.id)}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
            onClick={(e) => e.stopPropagation()}
            title="Glisser pour réassigner"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(item.type, referentiels?.typeLabels)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium truncate" title={item.title}>{item.title}</h4>
            {pConfig && (
              <span className={`text-[10px] font-bold ${pConfig.textColor} flex-shrink-0`} title={pConfig.label}>
                {pConfig.shortLabel}
              </span>
            )}
            {/* Accusé de lecture : icône seulement si l'assigné n'a pas encore ouvert l'item */}
            {item.assignmentReceipt && !item.assignmentReceipt.seenAt && (
              <span title="Pas encore vu par l'assigné" className="flex-shrink-0 text-orange-500">
                <EyeOff className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {stripMarkup(item.description)}
            </p>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemActionMenu
          groups={buildItemMenuGroups(item.id, { onEdit, onDelete, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren: hasChildItems(item) ? onAbsorbChildren : undefined, onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined, onOpen,
            onOpenInNewTab }, { item: item, canEdit: canEditItem ? canEditItem(item) : canEdit })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function MemberColumnComponent({
  column,
  items,
  isOver,
  onEdit,
  onDelete,
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
  canEdit,
  canEditItem,
  referentiels,
  draggedItemId,
}: {
  column: MemberColumn;
  items: Item[];
  isOver: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels;
  draggedItemId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const isFreeName = !!column.freeName;
  const isUnassigned = column.userId === null && !isFreeName;

  return (
    <div data-help-zone="members:colonne"
      className={`flex-1 min-w-[200px] bg-muted/50 rounded-lg border-t-4 flex flex-col transition-colors ${
        isUnassigned ? 'border-gray-300' : isFreeName ? 'border-dashed border-gray-400' : 'border-blue-400'
      } ${isOver ? 'bg-primary/5' : ''}`}
    >
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-muted/95 backdrop-blur-sm rounded-t-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isUnassigned ? (
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : isFreeName ? (
              <UserRound className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
            )}
            <h3 className="font-medium truncate">{column.name}</h3>
            {isFreeName && <span data-help-zone="members:sanscompte" className="text-[10px] italic text-muted-foreground flex-shrink-0">sans compte</span>}
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
            {items.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 flex-1 overflow-y-auto min-h-[60px] ${
          isOver ? 'ring-2 ring-primary ring-inset' : ''
        }`}
      >
        {items.map((item) => (
          <MemberKanbanCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
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
            isDragging={item.id === draggedItemId}
            canEdit={canEdit}
            canEditItem={canEditItem}
            referentiels={referentiels}
          />
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Aucun item</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resize handle (same pattern as KanbanView)
// ---------------------------------------------------------------------------

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const startY = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientY - startY.current;
      startY.current = ev.clientY;
      onResize(delta);
    };
    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      className="flex items-center justify-center h-3 cursor-row-resize group my-1"
      onMouseDown={handleMouseDown}
    >
      <GripHorizontal className="w-5 h-5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export function MembersKanbanView({
  items,
  spaceId,
  currentSpaceId,
  portalGroups,
  onEdit,
  onDelete,
  onUpdateAssignee,
  onAddChild,
  onMoveToSpace,
  onDuplicateToSpace,
  onSelfAssign,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
  onOpen,
            onOpenInNewTab,
  onConvertToSpace,
  referentiels,
  canEdit = true,
  canEditItem,
  spaceRole: _spaceRole, exportSpaceName, viewContainerRef, onStartTour, pulseHelp,
}: MembersKanbanViewProps) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [boardHeights, setBoardHeights] = useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getHeight = (sid: string) => boardHeights[sid] || DEFAULT_BOARD_HEIGHT;

  const handleResize = useCallback((sid: string, delta: number) => {
    setBoardHeights(prev => ({
      ...prev,
      [sid]: Math.max(MIN_BOARD_HEIGHT, (prev[sid] || DEFAULT_BOARD_HEIGHT) + delta),
    }));
  }, []);

  const filteredItems = items;

  // Build space sections (main + portals)
  const spaceSections = useMemo(() => {
    const mainSpaceId = currentSpaceId || spaceId;
    if (!portalGroups?.length) {
      return [{ spaceId: mainSpaceId, spaceName: null as string | null, isPortal: false, items: filteredItems }];
    }
    const mainItems = filteredItems.filter(i => i.spaceId === mainSpaceId);
    const sections = [{ spaceId: mainSpaceId, spaceName: null as string | null, isPortal: false, items: mainItems }];
    for (const pg of portalGroups) {
      const spaceItems = filteredItems.filter(i => i.spaceId === pg.spaceId);
      sections.push({ spaceId: pg.spaceId, spaceName: pg.spaceName, isPortal: true, items: spaceItems });
    }
    return sections;
  }, [filteredItems, currentSpaceId, spaceId, portalGroups]);

  // Fetch members for all spaces involved
  const allSpaceIds = useMemo(() => spaceSections.map(s => s.spaceId), [spaceSections]);

  // Fetch members for each space (connecté seulement : un visiteur n'a pas la liste des membres)
  const isLoggedIn = useAuthStore(s => !!s.user);
  const memberQueries = allSpaceIds.map(sid =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['space-members', sid],
      queryFn: () => spacesApi.getMembers(sid),
      enabled: !!sid && isLoggedIn,
    })
  );

  // Build columns per space
  const columnsBySpace = useMemo(() => {
    const result: Record<string, MemberColumn[]> = {};
    for (let i = 0; i < allSpaceIds.length; i++) {
      const sid = allSpaceIds[i];
      const members = isLoggedIn ? memberQueries[i].data || [] : assigneesFromItems(spaceSections[i].items as ItemWithRelations[]);
      const cols: MemberColumn[] = members.map(m => ({
        id: `${sid}::member-${m.userId}`,
        userId: m.userId,
        name: m.name,
      }));
      for (const f of freeNamesFromItems(spaceSections[i].items)) {
        cols.push({ id: `${sid}::name-${f.key}`, userId: null, name: f.name, freeName: f.name });
      }
      cols.push({ id: `${sid}::member-unassigned`, userId: null, name: 'Non assigné' });
      result[sid] = cols;
    }
    return result;
  }, [allSpaceIds, isLoggedIn, spaceSections, ...memberQueries.map(q => q.data)]);

  // Group items by column per space
  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const section of spaceSections) {
      const cols = columnsBySpace[section.spaceId] || [];
      for (const col of cols) {
        map.set(col.id, []);
      }
      for (const item of section.items) {
        const arr = map.get(columnIdOf(item, section.spaceId));
        if (arr) {
          arr.push(item);
        } else {
          map.get(`${section.spaceId}::member-unassigned`)?.push(item);
        }
      }
    }
    return map;
  }, [spaceSections, columnsBySpace]);

  // All columns flat (for resolving drops)
  const allColumns = useMemo(() =>
    Object.values(columnsBySpace).flat(),
    [columnsBySpace]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedItemId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItemId(null);
    setOverId(null);

    if (!over) return;

    const targetColId = over.id as string;
    const targetCol = allColumns.find(c => c.id === targetColId);
    if (!targetCol) return;

    const item = items.find(i => i.id === active.id);
    if (!item) return;

    // Même colonne (membre, nom libre de même clé ou « Non assigné ») : rien à faire
    const sameColumn = targetCol.userId
      ? item.assignedToId === targetCol.userId
      : !item.assignedToId && (targetCol.freeName
        ? freeNameKey(item.assignedToName ?? '') === freeNameKey(targetCol.freeName)
        : !item.assignedToName?.trim());
    if (sameColumn) return;

    if (targetCol.userId) onUpdateAssignee(item.id, targetCol.userId);           // membre : l'API efface le nom libre
    else onUpdateAssignee(item.id, null, targetCol.freeName ?? null);           // nom libre, ou « Non assigné » : tout effacer
  }, [allColumns, items, onUpdateAssignee]);

  const handleDragCancel = useCallback(() => {
    setDraggedItemId(null);
    setOverId(null);
  }, []);

  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;
  const hasMultipleSections = spaceSections.length > 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* ViewHeader */}
      <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        <div className="flex-1" />
        <ViewHelpButton viewMode="members" onStartTour={onStartTour} pulse={pulseHelp} />
        {exportSpaceName && viewContainerRef && (
          <SpaceExportButton items={items} spaceName={exportSpaceName} viewMode="members" viewContainerRef={viewContainerRef} />
        )}
      </div>
      {items.length === 0 && <EmptyHelp mode="members" title="Aucun élément" banner />}
      <div className="p-4 overflow-y-auto h-full space-y-2">
        {spaceSections.map((section, idx) => {
          const cols = columnsBySpace[section.spaceId] || [];
          return (
            <div key={section.spaceId}>
              {/* Resize handle between boards */}
              {idx > 0 && (
                <ResizeHandle onResize={(delta) => handleResize(spaceSections[idx - 1].spaceId, delta)} />
              )}

              {/* Portal header */}
              {section.isPortal && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <FolderKanban className="w-4 h-4 text-primary/70" />
                  <Link
                    to={`/spaces/${section.spaceId}`}
                    className="text-sm font-medium text-primary/70 hover:text-primary hover:underline"
                  >
                    {section.spaceName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    ({section.items.length} item{section.items.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {/* Board */}
              <div
                className={`overflow-x-auto ${section.isPortal ? 'border border-dashed border-primary/20 rounded-lg p-2' : ''}`}
                style={{ height: hasMultipleSections ? getHeight(section.spaceId) : undefined }}
              >
                <div className="flex gap-3 h-full min-h-0 min-w-min" {...(idx === 0 ? { 'data-tour': 'members-column' } : {})}>
                  {cols.map(col => (
                    <MemberColumnComponent
                      key={col.id}
                      column={col}
                      items={itemsByColumn.get(col.id) || []}
                      isOver={overId === col.id}
                      onEdit={onEdit}
                      onDelete={onDelete}
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
                      canEdit={canEdit}
                      canEditItem={canEditItem}
                      referentiels={referentiels}
                      draggedItemId={draggedItemId}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {draggedItem && (
          <div className="bg-card border rounded-lg p-3 shadow-lg max-w-[250px] opacity-90">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = getTypeIcon(draggedItem.type);
                return <Icon className={`w-4 h-4 flex-shrink-0 ${getTypeTextColor(draggedItem.type, referentiels?.typeLabels)}`} />;
              })()}
              <span className="text-sm font-medium truncate">{draggedItem.title}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

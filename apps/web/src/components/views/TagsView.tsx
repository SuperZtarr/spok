/* Vue Tags (décision Thomas 2026-11-11) : classer les éléments par tag sans ouvrir leur fiche, comme un Kanban sur les
 * tags. Colonne « Sans tag » d'abord, puis une colonne par tag porté par un élément affiché (triées par nom, couleur du
 * tag en tête) ; « + Colonne » ajoute un tag proposé dans l'espace mais pas encore porté (non mémorisé). Un élément à
 * plusieurs tags a une carte dans chacune de ses colonnes.
 * Gestes (règle tags-view-drop de businessRules.ts) : glisser une carte sur une colonne de tag lui AJOUTE ce tag (elle
 * reste dans sa colonne d'origine) ; la déposer sur « Sans tag » RETIRE le tag de la colonne d'où elle vient ; le
 * bouton × d'une carte retire le tag de sa colonne (accès visible, sans glisser). Pas de geste caché pour déplacer.
 * Props clés :
 * - items : éléments affichés (filtrés par la barre d'espace) ; tagOptions : tags proposés dans l'espace (communauté +
 *   globaux, GET /spaces/:id/tags) — couleurs et colonnes ajoutables
 * - onSetTags(itemId, tags) : enregistre la liste COMPLÈTE des tags de l'élément (SpacePage → useSpaceActions.handleSetTags)
 * - canEdit : faux → lecture seule (ni glisser, ni ×, ni « + Colonne »)
 * Carte = vignette commune format carte (ItemVignette, lib/itemFace.ts) + menu ⋮ (buildItemMenuGroups), comme le Kanban.
 * Aide : fiche components/views/help/tags.help.ts ; zones data-help-zone tags:* (colonne, sans-tag, carte, ajouter).
 * Mobile : vue masquée sous 640 px (VIEW_REGISTRY mobileHidden), comme le Kanban.
 */
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Plus, X } from 'lucide-react';
import type { Item, ItemType, SpaceReferentiels, Tag } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon, getTypeTextColor } from '../../constants/ui';
import { itemFace } from '../../lib/itemFace';
import { ItemVignette } from '../item/ItemVignette';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasChildItems } from '../../lib/itemMenuGroups';
import { ViewHelpButton } from '../ViewHelpButton';
import { SpaceExportButton } from '../SpaceExportButton';
import { EmptyHelp } from '../../help/EmptyHelp';
import { HelpHint } from '../../help/HelpHint';
import { help as tagsHelp } from './help/tags.help';

/** Identifiant de la colonne « Sans tag » */
export const NO_TAG_COLUMN = '__none__';

export interface TagsViewProps {
  items: Item[];
  tagOptions?: Tag[];
  onSetTags: (itemId: string, tags: Tag[]) => void;
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
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

type MenuHandlers = Pick<TagsViewProps, 'onEdit' | 'onDelete' | 'onUpdateStatus' | 'onAddChild' | 'onMoveToSpace' | 'onDuplicateToSpace'
  | 'onConvertToSpace' | 'onSelfAssign' | 'onMerge' | 'onAbsorbChildren' | 'onSplitDescription' | 'onOpen' | 'onOpenInNewTab'>;

/**
 * Nouvelle liste de tags d'un élément après un dépôt (règle tags-view-drop) ; null = rien à changer.
 * Sur une colonne de tag : ajout du tag. Sur « Sans tag » : retrait du tag de la colonne d'origine.
 */
export function tagsAfterDrop(itemTags: Tag[], fromColumn: string, toColumn: string, target?: Tag): Tag[] | null {
  if (fromColumn === toColumn) return null;
  if (toColumn === NO_TAG_COLUMN) {
    if (fromColumn === NO_TAG_COLUMN) return null;
    return itemTags.filter((t) => t.id !== fromColumn);
  }
  if (!target || itemTags.some((t) => t.id === toColumn)) return null;
  return [...itemTags, target];
}

/** Colonnes : « Sans tag », puis les tags portés par les éléments et les colonnes ajoutées, triés par nom */
export function buildTagColumns(items: Item[], extra: Tag[]): Tag[] {
  const byId = new Map<string, Tag>();
  for (const item of items) for (const t of item.tags ?? []) byId.set(t.id, t);
  for (const t of extra) if (!byId.has(t.id)) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

function TagCard({ item, columnId, canEdit, canEditItem, referentiels, onRemove, handlers }: {
  item: Item; columnId: string; canEdit: boolean; canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels; onRemove?: () => void; handlers: MenuHandlers;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${columnId}::${item.id}`,
    data: { itemId: item.id, fromColumn: columnId },
    disabled: !canEdit,
  });
  const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  const hasHeadings = !!item.description && /<h[1-3][^>]*>/i.test(item.description);

  return (
    <div
      ref={setNodeRef}
      data-help-zone="tags:carte"
      data-tour="tags-carte"
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${isDragging ? 'opacity-40' : ''}`}
      onClick={() => handlers.onEdit(item.id)}
    >
      <ItemVignette
        format="carte"
        title={item.title}
        Icon={getTypeIcon(item.type)}
        iconClass={getTypeTextColor(item.type, referentiels?.typeLabels)}
        tags={item.tags}
        face={itemFace(item, 'carte', {
          type: (referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels)[item.type as ItemType]?.labelShort ?? item.type,
          status: item.status && item.status !== 'undefined' ? statuses.find((s) => s.id === item.status)?.label ?? null : null,
        })}
        leading={canEdit ? (
          <HelpHint text={tagsHelp.hints?.drag}>
            <div
              {...listeners}
              {...attributes}
              aria-label="Glisser vers une colonne"
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          </HelpHint>
        ) : undefined}
      />
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onRemove && (
          <HelpHint text={tagsHelp.hints?.remove}>
            <button
              type="button"
              aria-label="Retirer ce tag de l'élément"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </HelpHint>
        )}
        <ItemActionMenu
          groups={buildItemMenuGroups(item.id, {
            ...handlers,
            onAbsorbChildren: hasChildItems(item) ? handlers.onAbsorbChildren : undefined,
            onSplitDescription: hasHeadings ? handlers.onSplitDescription : undefined,
          }, {
            item,
            canEdit: canEditItem ? canEditItem(item) : canEdit,
            statusOptions: statuses,
            currentStatusId: item.status || undefined,
          })}
        />
      </div>
    </div>
  );
}

function TagColumn({ columnId, tag, items, isOver, children }: {
  columnId: string; tag?: Tag; items: Item[]; isOver: boolean; children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });
  const isNone = columnId === NO_TAG_COLUMN;
  // Repères écrits en littéraux (contrôlés par help/coverage.test.ts)
  const helpAttrs = isNone
    ? { 'data-help-zone': 'tags:sans-tag', 'data-tour': 'tags-sans-tag' }
    : { 'data-help-zone': 'tags:colonne', 'data-tour': 'tags-colonne' };
  return (
    <div
      {...helpAttrs}
      className="w-64 flex-shrink-0 bg-muted/50 rounded-lg border-t-4 flex flex-col"
      style={{ borderTopColor: tag?.color ?? (isNone ? 'transparent' : undefined) }}
    >
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-muted/95 backdrop-blur-sm rounded-t-lg flex items-center justify-between gap-2">
        <HelpHint text={isNone ? tagsHelp.hints?.noTagColumn : tagsHelp.hints?.column}>
          <h3 className={`font-medium truncate ${isNone ? 'italic text-muted-foreground' : ''}`}>{isNone ? 'Sans tag' : tag?.name}</h3>
        </HelpHint>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div ref={setNodeRef} className={`p-2 space-y-2 flex-1 overflow-y-auto min-h-[60px] ${isOver ? 'ring-2 ring-primary ring-inset' : ''}`}>
        {children}
        {items.length === 0 && <div className="text-center py-4 text-muted-foreground text-sm">Aucun élément</div>}
      </div>
    </div>
  );
}

export function TagsView({
  items, tagOptions = [], onSetTags, referentiels, canEdit = true, canEditItem,
  spaceName, viewContainerRef, onStartTour, pulseHelp, ...handlers
}: TagsViewProps) {
  const [extraColumns, setExtraColumns] = useState<Tag[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const columns = useMemo(() => buildTagColumns(items, extraColumns), [items, extraColumns]);
  const addable = useMemo(
    () => tagOptions.filter((t) => !columns.some((c) => c.id === t.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })),
    [tagOptions, columns],
  );
  const untagged = useMemo(() => items.filter((i) => !i.tags || i.tags.length === 0), [items]);
  const tagById = useMemo(() => new Map([...tagOptions, ...columns].map((t) => [t.id, t])), [tagOptions, columns]);
  const activeItem = activeItemId ? items.find((i) => i.id === activeItemId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveItemId((e.active.data.current as { itemId: string }).itemId);
  const handleDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null);
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveItemId(null);
    setOverId(null);
    if (!e.over) return;
    const { itemId, fromColumn } = e.active.data.current as { itemId: string; fromColumn: string };
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const toColumn = String(e.over.id);
    const next = tagsAfterDrop(item.tags ?? [], fromColumn, toColumn, tagById.get(toColumn));
    if (next) onSetTags(itemId, next);
  };

  const removeTag = (item: Item, tagId: string) => onSetTags(item.id, (item.tags ?? []).filter((t) => t.id !== tagId));

  const renderCards = (columnId: string, list: Item[]) => list.map((item) => (
    <TagCard
      key={`${columnId}::${item.id}`}
      item={item}
      columnId={columnId}
      canEdit={canEdit}
      canEditItem={canEditItem}
      referentiels={referentiels}
      handlers={handlers}
      onRemove={canEdit && columnId !== NO_TAG_COLUMN ? () => removeTag(item, columnId) : undefined}
    />
  ));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        {canEdit && (
          <div className="relative" data-help-zone="tags:ajouter">
            <HelpHint text={tagsHelp.hints?.addColumn}>
              <button
                type="button"
                data-tour="tags-ajouter"
                onClick={() => setAddOpen((v) => !v)}
                disabled={addable.length === 0}
                className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Colonne</span>
              </button>
            </HelpHint>
            {addOpen && addable.length > 0 && (
              <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-56 max-h-72 overflow-y-auto">
                {addable.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setExtraColumns((prev) => [...prev, t]); setAddOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.color ? '' : 'bg-muted-foreground/40'}`} style={t.color ? { backgroundColor: t.color } : undefined} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex-1" />
        <ViewHelpButton viewMode="tags" onStartTour={onStartTour} pulse={pulseHelp} />
        {spaceName && viewContainerRef && (
          <SpaceExportButton items={items} spaceName={spaceName} viewMode="tags" viewContainerRef={viewContainerRef} />
        )}
      </div>
      {items.length === 0 && <EmptyHelp mode="tags" title="Aucun élément" banner />}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver}
        onDragEnd={handleDragEnd} onDragCancel={() => { setActiveItemId(null); setOverId(null); }}>
        <div className="p-4 overflow-auto h-full" data-help-zone="tags:contenu">
          <div className="flex gap-3 h-full min-h-0">
            <TagColumn columnId={NO_TAG_COLUMN} items={untagged} isOver={overId === NO_TAG_COLUMN}>
              {renderCards(NO_TAG_COLUMN, untagged)}
            </TagColumn>
            {columns.map((tag) => {
              const list = items.filter((i) => i.tags?.some((t) => t.id === tag.id));
              return (
                <TagColumn key={tag.id} columnId={tag.id} tag={tag} items={list} isOver={overId === tag.id}>
                  {renderCards(tag.id, list)}
                </TagColumn>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 w-[200px] flex items-start gap-2">
              {(() => {
                const Icon = getTypeIcon(activeItem.type);
                return <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(activeItem.type, referentiels?.typeLabels)}`} />;
              })()}
              <h4 className="text-sm font-medium truncate">{activeItem.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

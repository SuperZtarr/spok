/* Vue Tags (décision Thomas 2026-11-11, refonte le même jour après essai) : classer les éléments par tag sans ouvrir
 * leur fiche, comme un Kanban sur les tags.
 * Colonnes : « Sans tag », puis TOUS les tags proposés dans l'espace (tagOptions : globaux, communauté, espace et
 * espaces parents), même vides,
 * plus un tag porté qui n'y serait pas ; « Masquer les tags vides » les retire de l'affichage (non mémorisé). Un élément
 * à plusieurs tags a une carte dans chacune de ses colonnes.
 * Palette en haut : une pastille par tag, une ligne par portée — globaux, communauté, espace (tags de l'espace puis
 *   ceux hérités d'un espace parent) — via lib/tagScope.ts (demandes Thomas 2026-11-11 et 2026-11-12).
 * Gestes (règle tags-view-drop de businessRules.ts) :
 * - pastille glissée sur une carte → ce tag ajouté à l'élément (à toute la sélection si la carte est cochée) ;
 * - carte glissée sur une colonne de tag → tag ajouté (elle reste dans sa colonne d'origine) ; sur « Sans tag » → tag
 *   de la colonne d'origine retiré ; carte cochée → même effet sur toute la sélection ;
 * - × d'une carte → tag de sa colonne retiré ; barre de sélection → Ajouter un tag / Retirer un tag / Désélectionner.
 * Accès visibles : cases à cocher, ×, barre de sélection — le glisser n'est jamais le seul moyen.
 * Props clés :
 * - items : éléments affichés (filtrés par la barre d'espace) ; tagOptions : tags proposés (portée pour la palette)
 * - onSetTags(itemId, tags) : liste COMPLÈTE des tags d'un élément ; onBulkTags(itemIds, add, removeIds) : plusieurs
 *   éléments en une requête (SpacePage → useSpaceActions)
 * - canEdit : faux → lecture seule (ni palette, ni cases, ni glisser, ni ×)
 * Carte = vignette commune format carte (ItemVignette, lib/itemFace.ts) + menu ⋮ (buildItemMenuGroups), comme le Kanban.
 * Aide : fiche components/views/help/tags.help.ts ; zones data-help-zone tags:* (palette, selection, colonne, sans-tag, carte).
 * Mobile : vue masquée sous 640 px (VIEW_REGISTRY mobileHidden), comme le Kanban.
 */
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Minus, Plus, X } from 'lucide-react';
import type { Item, ItemType, SpaceReferentiels, Tag } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { getTypeIcon, getTypeTextColor } from '../../constants/ui';
import { itemFace } from '../../lib/itemFace';
import { ItemVignette } from '../item/ItemVignette';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { TagBadge } from '../ui/TagBadge';
import { buildItemMenuGroups, hasChildItems } from '../../lib/itemMenuGroups';
import { ViewHelpButton } from '../ViewHelpButton';
import { SpaceExportButton } from '../SpaceExportButton';
import { EmptyHelp } from '../../help/EmptyHelp';
import { HelpHint } from '../../help/HelpHint';
import { help as tagsHelp } from './help/tags.help';
import { groupTagsByScope } from '../../lib/tagScope';

/** Identifiant de la colonne « Sans tag » */
export const NO_TAG_COLUMN = '__none__';

type ViewTag = Tag & { isGlobalTag?: boolean };

export interface TagsViewProps {
  items: Item[];
  tagOptions?: ViewTag[];
  onSetTags: (itemId: string, tags: Tag[]) => void;
  onBulkTags: (itemIds: string[], add: Tag[], removeIds?: string[]) => void;
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

/** Données portées par un élément glissé ou une cible de dépôt */
type DragData = { kind: 'card'; itemId: string; columnId: string } | { kind: 'chip'; tagId: string };
type DropData = { kind: 'card' | 'column'; columnId: string; itemId?: string };

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

/**
 * Nouvelle liste de tags d'un élément après le dépôt de sa carte (règle tags-view-drop) ; null = rien à changer.
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

/** Colonnes de tags : tous les tags proposés, plus ceux portés par les éléments et absents des propositions, triés */
export function buildTagColumns(items: Item[], tagOptions: Tag[]): Tag[] {
  const byId = new Map<string, Tag>();
  for (const t of tagOptions) byId.set(t.id, t);
  for (const item of items) for (const t of item.tags ?? []) if (!byId.has(t.id)) byId.set(t.id, t);
  return [...byId.values()].sort(byName);
}

/** Palette : une ligne par portée — globaux, communauté, espace (demandes Thomas 2026-11-11 et 2026-11-12) */
export function splitPalette(tagOptions: ViewTag[]) {
  return groupTagsByScope(tagOptions);
}

/** Éléments visés par un geste sur un élément : toute la sélection s'il en fait partie, sinon lui seul */
export function targetsOf(itemId: string, selected: Set<string>): string[] {
  return selected.has(itemId) ? [...selected] : [itemId];
}

// Cible préférée : la carte sous le pointeur (pastille déposée sur un élément), sinon la colonne
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const card = hits.find((h) => String(h.id).startsWith('card::'));
  return card ? [card] : hits;
};

function PaletteChip({ tag }: { tag: Tag }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip::${tag.id}`, data: { kind: 'chip', tagId: tag.id } satisfies DragData });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}>
      <TagBadge tag={tag} />
    </span>
  );
}

function TagCard({ item, columnId, canEdit, canEditItem, referentiels, selected, onToggleSelect, onRemove, handlers }: {
  item: Item; columnId: string; canEdit: boolean; canEditItem?: (item: { createdById?: string }) => boolean;
  referentiels?: SpaceReferentiels; selected: boolean; onToggleSelect: () => void; onRemove?: () => void; handlers: MenuHandlers;
}) {
  const id = `card::${columnId}::${item.id}`;
  const drag = useDraggable({ id, data: { kind: 'card', itemId: item.id, columnId } satisfies DragData, disabled: !canEdit });
  const drop = useDroppable({ id, data: { kind: 'card', columnId, itemId: item.id } satisfies DropData, disabled: !canEdit });
  const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  const hasHeadings = !!item.description && /<h[1-3][^>]*>/i.test(item.description);
  const chipOver = drop.isOver && drop.active?.data.current?.kind === 'chip';

  return (
    <div
      ref={(node) => { drag.setNodeRef(node); drop.setNodeRef(node); }}
      data-help-zone="tags:carte"
      data-tour="tags-carte"
      className={`relative bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group ${drag.isDragging ? 'opacity-40' : ''} ${
        selected ? 'ring-2 ring-primary' : ''} ${chipOver ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
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
          <div className="flex flex-col items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <HelpHint text={tagsHelp.hints?.select}>
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                aria-label="Sélectionner l'élément"
                className={`w-3.5 h-3.5 cursor-pointer ${selected ? '' : 'opacity-40 group-hover:opacity-100'}`}
              />
            </HelpHint>
            <HelpHint text={tagsHelp.hints?.drag}>
              <div {...drag.listeners} {...drag.attributes} aria-label="Glisser vers une colonne"
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                <GripVertical className="w-4 h-4" />
              </div>
            </HelpHint>
          </div>
        ) : undefined}
      />
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onRemove && (
          <HelpHint text={tagsHelp.hints?.remove}>
            <button type="button" aria-label="Retirer ce tag de l'élément" onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </HelpHint>
        )}
        <ItemActionMenu
          groups={buildItemMenuGroups(item.id, {
            ...handlers,
            onAbsorbChildren: hasChildItems(item) ? handlers.onAbsorbChildren : undefined,
            onSplitDescription: hasHeadings ? handlers.onSplitDescription : undefined,
          }, { item, canEdit: canEditItem ? canEditItem(item) : canEdit, statusOptions: statuses, currentStatusId: item.status || undefined })}
        />
      </div>
    </div>
  );
}

function TagColumn({ columnId, tag, items, isOver, allSelected, onSelectAll, canEdit, children }: {
  columnId: string; tag?: Tag; items: Item[]; isOver: boolean; allSelected: boolean; onSelectAll: () => void; canEdit: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `col::${columnId}`, data: { kind: 'column', columnId } satisfies DropData });
  const isNone = columnId === NO_TAG_COLUMN;
  // Repères écrits en littéraux (contrôlés par help/coverage.test.ts)
  const helpAttrs = isNone
    ? { 'data-help-zone': 'tags:sans-tag', 'data-tour': 'tags-sans-tag' }
    : { 'data-help-zone': 'tags:colonne', 'data-tour': 'tags-colonne' };
  return (
    <div {...helpAttrs} className="w-64 flex-shrink-0 bg-muted/50 rounded-lg border-t-4 flex flex-col"
      style={{ borderTopColor: tag?.color ?? (isNone ? 'transparent' : undefined) }}>
      <div className="p-3 border-b border-border sticky top-0 z-10 bg-muted/95 backdrop-blur-sm rounded-t-lg flex items-center gap-2">
        {canEdit && items.length > 0 && (
          <HelpHint text={tagsHelp.hints?.selectColumn}>
            <input type="checkbox" checked={allSelected} onChange={onSelectAll} aria-label="Tout cocher dans cette colonne" className="w-3.5 h-3.5 cursor-pointer" />
          </HelpHint>
        )}
        <HelpHint text={isNone ? tagsHelp.hints?.noTagColumn : tagsHelp.hints?.column}>
          <h3 className={`font-medium truncate flex-1 ${isNone ? 'italic text-muted-foreground' : ''}`}>{isNone ? 'Sans tag' : tag?.name}</h3>
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

function TagMenu({ label, icon: Icon, tags, onPick, hint }: { label: string; icon: typeof Plus; tags: Tag[]; onPick: (t: Tag) => void; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <HelpHint text={hint}>
        <button type="button" onClick={() => setOpen((v) => !v)} disabled={tags.length === 0}
          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-background border border-input hover:bg-accent disabled:opacity-50">
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      </HelpHint>
      {open && tags.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-56 max-h-72 overflow-y-auto">
          {tags.map((t) => (
            <button key={t.id} type="button" onClick={() => { onPick(t); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.color ? '' : 'bg-muted-foreground/40'}`} style={t.color ? { backgroundColor: t.color } : undefined} />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TagsView({
  items, tagOptions = [], onSetTags, onBulkTags, referentiels, canEdit = true, canEditItem,
  spaceName, viewContainerRef, onStartTour, pulseHelp, ...handlers
}: TagsViewProps) {
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<DragData | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  // Sélection limitée aux éléments encore affichés (filtre changé, élément supprimé)
  const selection = useMemo(() => new Set([...selected].filter((id) => visibleIds.has(id))), [selected, visibleIds]);

  const allColumns = useMemo(() => buildTagColumns(items, tagOptions), [items, tagOptions]);
  const tagById = useMemo(() => new Map(allColumns.map((t) => [t.id, t])), [allColumns]);
  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Item[]>([[NO_TAG_COLUMN, items.filter((i) => !i.tags || i.tags.length === 0)]]);
    for (const tag of allColumns) map.set(tag.id, items.filter((i) => i.tags?.some((t) => t.id === tag.id)));
    return map;
  }, [items, allColumns]);
  const columns = hideEmpty ? allColumns.filter((t) => (itemsByColumn.get(t.id) ?? []).length > 0) : allColumns;
  const palette = useMemo(() => splitPalette(tagOptions), [tagOptions]);
  const selectionTags = useMemo(() => {
    const ids = new Set(items.filter((i) => selection.has(i.id)).flatMap((i) => (i.tags ?? []).map((t) => t.id)));
    return allColumns.filter((t) => ids.has(t.id));
  }, [items, selection, allColumns]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleColumn = (list: Item[]) => setSelected((prev) => {
    const next = new Set(prev);
    const all = list.every((i) => next.has(i.id));
    for (const i of list) if (all) next.delete(i.id); else next.add(i.id);
    return next;
  });

  const handleDragStart = (e: DragStartEvent) => setActive(e.active.data.current as DragData);
  const handleDragOver = (e: DragOverEvent) => setOverColumn((e.over?.data.current as DropData | undefined)?.kind === 'column'
    ? (e.over!.data.current as DropData).columnId : null);
  const handleDragEnd = (e: DragEndEvent) => {
    setActive(null);
    setOverColumn(null);
    const drag = e.active.data.current as DragData | undefined;
    const drop = e.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;

    if (drag.kind === 'chip') {
      // Pastille déposée sur une carte : tag ajouté à l'élément, ou à toute la sélection si la carte est cochée
      const tag = tagById.get(drag.tagId);
      if (drop.kind === 'card' && drop.itemId && tag) onBulkTags(targetsOf(drop.itemId, selection), [tag]);
      return;
    }

    const toColumn = drop.columnId;
    if (toColumn === drag.columnId) return;
    const targets = targetsOf(drag.itemId, selection);
    if (targets.length > 1) {
      if (toColumn === NO_TAG_COLUMN) {
        if (drag.columnId !== NO_TAG_COLUMN) onBulkTags(targets, [], [drag.columnId]);
      } else {
        const tag = tagById.get(toColumn);
        if (tag) onBulkTags(targets, [tag]);
      }
      return;
    }
    const item = items.find((i) => i.id === drag.itemId);
    if (!item) return;
    const next = tagsAfterDrop(item.tags ?? [], drag.columnId, toColumn, tagById.get(toColumn));
    if (next) onSetTags(item.id, next);
  };

  const activeItem = active?.kind === 'card' ? items.find((i) => i.id === active.itemId) : null;
  const activeTag = active?.kind === 'chip' ? tagById.get(active.tagId) : null;

  const renderColumn = (columnId: string, tag?: Tag) => {
    const list = itemsByColumn.get(columnId) ?? [];
    return (
      <TagColumn key={columnId} columnId={columnId} tag={tag} items={list} isOver={overColumn === columnId} canEdit={canEdit}
        allSelected={list.length > 0 && list.every((i) => selection.has(i.id))} onSelectAll={() => toggleColumn(list)}>
        {list.map((item) => (
          <TagCard
            key={`${columnId}::${item.id}`}
            item={item}
            columnId={columnId}
            canEdit={canEdit}
            canEditItem={canEditItem}
            referentiels={referentiels}
            handlers={handlers}
            selected={selection.has(item.id)}
            onToggleSelect={() => toggle(item.id)}
            onRemove={canEdit && columnId !== NO_TAG_COLUMN ? () => onSetTags(item.id, (item.tags ?? []).filter((t) => t.id !== columnId)) : undefined}
          />
        ))}
      </TagColumn>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-2 px-2 py-1 border-b border-border bg-background flex-shrink-0">
        <HelpHint text={tagsHelp.hints?.hideEmpty}>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" data-tour="tags-masquer">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="w-3.5 h-3.5" />
            Masquer les tags vides
          </label>
        </HelpHint>
        <div className="flex-1" />
        <ViewHelpButton viewMode="tags" onStartTour={onStartTour} pulse={pulseHelp} />
        {spaceName && viewContainerRef && (
          <SpaceExportButton items={items} spaceName={spaceName} viewMode="tags" viewContainerRef={viewContainerRef} />
        )}
      </div>
      {items.length === 0 && <EmptyHelp mode="tags" title="Aucun élément" banner />}
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={handleDragStart} onDragOver={handleDragOver}
        onDragEnd={handleDragEnd} onDragCancel={() => { setActive(null); setOverColumn(null); }}>
        {canEdit && tagOptions.length > 0 && (
          <div className="px-4 pt-3 space-y-1.5 flex-shrink-0" data-help-zone="tags:palette" data-tour="tags-palette">
            {palette.map(({ scope, label, tags: list }) => (
              <div key={scope} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground w-24 flex-shrink-0">{label}</span>
                {list.map((t) => <PaletteChip key={t.id} tag={t} />)}
              </div>
            ))}
          </div>
        )}
        {canEdit && selection.size > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 flex flex-wrap items-center gap-2 flex-shrink-0"
            data-help-zone="tags:selection" data-tour="tags-selection">
            <span className="text-sm font-medium">{selection.size} élément{selection.size > 1 ? 's' : ''} sélectionné{selection.size > 1 ? 's' : ''}</span>
            <TagMenu label="Ajouter un tag" icon={Plus} tags={allColumns} hint={tagsHelp.hints?.bulkAdd}
              onPick={(t) => onBulkTags([...selection], [t])} />
            <TagMenu label="Retirer un tag" icon={Minus} tags={selectionTags} hint={tagsHelp.hints?.bulkRemove}
              onPick={(t) => onBulkTags([...selection], [], [t.id])} />
            <HelpHint text={tagsHelp.hints?.clearSelection}>
              <button type="button" onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:bg-accent">
                <X className="w-3.5 h-3.5" /> Désélectionner
              </button>
            </HelpHint>
          </div>
        )}
        <div className="p-4 overflow-auto flex-1 min-h-0" data-help-zone="tags:contenu">
          <div className="flex gap-3 h-full min-h-0">
            {renderColumn(NO_TAG_COLUMN)}
            {columns.map((tag) => renderColumn(tag.id, tag))}
          </div>
        </div>
        <DragOverlay>
          {activeTag ? <TagBadge tag={activeTag} /> : activeItem ? (
            <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 w-[200px] flex items-start gap-2">
              {(() => {
                const Icon = getTypeIcon(activeItem.type);
                return <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${getTypeTextColor(activeItem.type, referentiels?.typeLabels)}`} />;
              })()}
              <h4 className="text-sm font-medium truncate">
                {activeItem.title}
                {selection.has(activeItem.id) && selection.size > 1 && <span className="ml-1 text-xs text-primary">+{selection.size - 1}</span>}
              </h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

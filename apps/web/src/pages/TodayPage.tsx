/*
 * Page /today « Ma journée » — écran d'atterrissage du matin : grille horaire 7h-minuit
 * (réunions ICS/MEETING fixes + blocs de tâches déplaçables, time-blocking) à gauche,
 * liste du jour (tâches non placées + suggestions) à droite.
 * Colonnes d'agenda (spec 2026-07-18) : une par feed ICS + une « SPOK », visibilité
 * choisie par pastilles au-dessus de la grille, persistée en localStorage
 * (spok-today-visible-sources) — indépendante du `enabled` des feeds.
 * État local uniquement (date affichée, modales, visibilité colonnes) — pas de store Zustand.
 * Le marquage « fait » passe par itemsApi.update (status done) : une seule vérité, l'item.
 * Le placement (plannedStart/plannedDuration) vit sur DayPlanEntry, jamais sur l'item.
 */
import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_REFERENTIELS, type Item } from '@spok/shared';
import { useAuthStore } from '@/stores/auth';
import { ItemEditModal } from '@/components/ItemEditModal';
import { buildItemMenuGroups } from '@/lib/itemMenuGroups';
import type { ItemActionGroup } from '@/components/ui/ItemActionMenu';
import { useAgenda, useAgendaMutations, useCalendarFeeds, todayKey } from '@/hooks/useAgenda';
import { useGlobalTaskFilters } from '@/hooks/useGlobalTaskFilters';
import { GlobalTaskFilterBar } from '@/components/GlobalTaskFilterBar';
import { itemsApi, type AgendaFilters, type DayPlanEntryDto, type DayPlanItemDto } from '@/lib/api';
import { findFreeSlot, type BusyInterval } from '@/lib/timeblock';
import { DayTimeGrid, type AgendaSourceCol, type DropPayload, type EventDropPayload } from '@/components/today/DayTimeGrid';
import { DayPlanList } from '@/components/today/DayPlanList';
import { CalendarFeedsModal } from '@/components/today/CalendarFeedsModal';
import { PickTasksModal } from '@/components/today/PickTasksModal';

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Visibilité des colonnes d'agenda (spec 2026-07-18-today-columns-per-agenda) :
// clé absente = visible par défaut. Indépendant du `enabled` des feeds (qui coupe la
// récupération serveur) — ici on ne joue que sur l'affichage des colonnes.
const VISIBLE_SOURCES_KEY = 'spok-today-visible-sources';

function loadVisibleSources(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(VISIBLE_SOURCES_KEY) || '{}'); } catch { return {}; }
}

export function TodayPage() {
  const [date, setDate] = useState(todayKey());
  const [feedsOpen, setFeedsOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  // Filtre global (même barre que Tableau de bord / Tâches) : n'agit que sur les
  // suggestions et la pioche — jamais sur le plan engagé ni la grille.
  // defaultTypes: [] — /today veut voir tous les types par défaut (pas seulement TASK,
  // contrairement à la page Tâches globales).
  const filters = useGlobalTaskFilters({ defaultTypes: [] });
  const agendaFilters: AgendaFilters = {
    type: filters.queryParams.type,
    spaceId: filters.queryParams.spaceId,
    communityId: filters.queryParams.communityId,
    status: filters.queryParams.status,
    priority: filters.queryParams.priority,
    search: filters.queryParams.search,
  };
  const { data, isLoading } = useAgenda(date, agendaFilters);
  const { addToPlan, removeFromPlan, updateEntry, createFromEvent } = useAgendaMutations(date);
  const queryClient = useQueryClient();

  // Colonnes d'agenda : un feed ICS = une colonne + une colonne SPOK dédiée, dans cet
  // ordre (spec 2026-07-18). Visibilité indépendante du `enabled` des feeds.
  const { data: feeds = [] } = useCalendarFeeds();
  const allSources: AgendaSourceCol[] = [
    ...feeds.map((f) => ({ key: `feed:${f.id}`, name: f.name, color: f.color })),
    { key: 'spok', name: 'SPOK', color: 'var(--primary)' },
  ];
  const [visibleSources, setVisibleSources] = useState<Record<string, boolean>>(loadVisibleSources);
  const toggleSource = (key: string) => {
    setVisibleSources((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? true) };
      localStorage.setItem(VISIBLE_SOURCES_KEY, JSON.stringify(next));
      return next;
    });
  };
  const visibleSourceList = allSources.filter((s) => visibleSources[s.key] ?? true);

  const busy: BusyInterval[] = [
    ...(data?.events ?? []).filter((e) => !e.allDay && e.end).map((e) => ({ start: new Date(e.start), end: new Date(e.end!) })),
    ...(data?.plan ?? []).filter((p) => p.plannedStart).map((p) => ({
      start: new Date(p.plannedStart!),
      end: new Date(new Date(p.plannedStart!).getTime() + (p.plannedDuration ?? 30) * 60000),
    })),
  ];
  // Menu contextuel des items (liste, suggestions, blocs de grille) + modale d'édition
  const [editingItem, setEditingItem] = useState<{ spaceId: string; itemId: string } | null>(null);
  const { data: spaceItemsData } = useQuery({
    queryKey: ['items', editingItem?.spaceId, { pageSize: 5000 }],
    queryFn: () => itemsApi.list(editingItem!.spaceId, { pageSize: 5000 }),
    enabled: !!editingItem,
  });
  const invalidateAgenda = () => queryClient.invalidateQueries({ queryKey: ['agenda', date] });
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Statuts proposés dans le menu : référentiels PAR DÉFAUT — page multi-espaces, on ne
  // charge pas les référentiels personnalisés de chaque espace (même compromis que /tasks).
  const statusOptions = DEFAULT_REFERENTIELS.statuses
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, label: s.label }));
  const menuGroupsFor = (item: DayPlanItemDto): ItemActionGroup[] =>
    buildItemMenuGroups(item.id, {
      onOpen: () => setEditingItem({ spaceId: item.spaceId, itemId: item.id }),
      onOpenInNewTab: () => window.open(`/spaces/${item.spaceId}/content?item=${item.id}`, '_blank'),
      onEdit: () => setEditingItem({ spaceId: item.spaceId, itemId: item.id }),
      onUpdateStatus: async (_id, status) => {
        await itemsApi.update(item.spaceId, item.id, { status });
        invalidateAgenda();
        queryClient.invalidateQueries({ queryKey: ['items', item.spaceId] });
      },
      onSelfAssign: currentUserId ? async () => {
        await itemsApi.update(item.spaceId, item.id, { assignedToId: currentUserId });
        invalidateAgenda();
        queryClient.invalidateQueries({ queryKey: ['items', item.spaceId] });
      } : undefined,
      onDelete: async () => {
        if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
        await itemsApi.delete(item.spaceId, item.id);
        invalidateAgenda();
      },
    }, { canEdit: true, itemSpaceId: item.spaceId, statusOptions, currentStatusId: item.status ?? undefined });

  // Drop depuis la liste : une tâche engagée est placée, une suggestion est engagée + placée
  const handleDropAt = (payload: DropPayload, startIso: string, durationMin: number) => {
    if (payload.kind === 'entry') {
      updateEntry.mutate({ id: payload.id, plannedStart: startIso, plannedDuration: durationMin });
    } else {
      addToPlan.mutate({ itemId: payload.id, source: 'auto', plannedStart: startIso, plannedDuration: durationMin });
    }
  };

  // Drop d'un événement (réunion) sur la liste du jour : crée une TASK (titre + échéance
  // de l'événement) dans l'espace personnel et l'engage — n'altère jamais l'événement source.
  const handleDropEvent = (payload: EventDropPayload) => {
    createFromEvent.mutate({ title: payload.title, dueDate: payload.start });
  };

  const placeEntry = (entry: DayPlanEntryDto) => {
    const dayStart = new Date(`${date}T07:00:00`);
    const dayEnd = new Date(`${date}T23:59:00`);
    const slot = findFreeSlot(busy, 30, new Date(), dayStart, dayEnd);
    if (!slot) return; // journée pleine — la tâche reste dans la liste
    updateEntry.mutate({ id: entry.id, plannedStart: slot.toISOString(), plannedDuration: 30 });
  };

  const toggleDone = async (item: DayPlanItemDto) => {
    await itemsApi.update(item.spaceId, item.id, { status: item.status === 'done' ? 'todo' : 'done' });
    queryClient.invalidateQueries({ queryKey: ['agenda', date] });
    queryClient.invalidateQueries({ queryKey: ['items', item.spaceId] });
  };

  const isToday = date === todayKey();
  const label = new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <button onClick={() => setDate(shiftDate(date, -1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Jour précédent">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setDate(shiftDate(date, 1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Jour suivant">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold capitalize ml-1">{label}</h1>
        {!isToday && (
          <button onClick={() => setDate(todayKey())} className="h-7 px-2 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            Aujourd'hui
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => setFeedsOpen(true)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Calendriers">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-1 border-b border-border">
        <GlobalTaskFilterBar filters={filters} />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          /* Grille = toute la largeur disponible ; liste du jour = colonne fixe compacte
             (retour Thomas 2026-07-18 : liste trop large, colonnes d'agenda trop étroites). */
          <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,1fr)_minmax(300px,380px)] gap-6">
            <div className="min-w-0">
              {(data?.feedErrors?.length ?? 0) > 0 && (
                <p className="mb-2 inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Calendrier(s) injoignable(s) : {data!.feedErrors.map((f) => f.name).join(', ')}
                </p>
              )}
              {(data?.events ?? []).filter((e) => e.allDay).map((e) => (
                <div
                  key={e.id}
                  className="mb-1 flex items-center gap-2 rounded border border-border bg-accent/40 px-2 py-1 text-sm cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(ev) => ev.dataTransfer.setData('application/json', JSON.stringify({ kind: 'event', title: e.title, start: e.start } satisfies EventDropPayload))}
                  title="Glisser vers la liste du jour pour créer une tâche"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
                  <span className="truncate">{e.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">journée</span>
                </div>
              ))}
              {/* Choix des colonnes d'agenda affichées — indépendant de l'activation des
                  feeds (icône réglages) : ici on ne joue que sur l'affichage. */}
              <div className="flex flex-wrap gap-1 mb-2">
                {allSources.map((s) => {
                  const visible = visibleSources[s.key] ?? true;
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSource(s.key)}
                      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium border transition-colors ${
                        visible
                          ? 'border-border bg-accent text-foreground'
                          : 'border-border/50 text-muted-foreground/60 hover:text-muted-foreground'
                      }`}
                      title={visible ? `Masquer la colonne ${s.name}` : `Afficher la colonne ${s.name}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color ?? 'var(--muted-foreground)', opacity: visible ? 1 : 0.4 }}
                      />
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <DayTimeGrid
                date={date}
                sources={visibleSourceList}
                events={data?.events ?? []}
                entries={data?.plan ?? []}
                onMove={(id, startIso) => updateEntry.mutate({ id, plannedStart: startIso })}
                onResize={(id, durationMin) => updateEntry.mutate({ id, plannedDuration: durationMin })}
                onUnplace={(id) => updateEntry.mutate({ id, plannedStart: null })}
                onDropAt={handleDropAt}
                menuGroupsFor={menuGroupsFor}
              />
            </div>
            <DayPlanList
              plan={data?.plan ?? []}
              suggestions={data?.suggestions ?? []}
              onAccept={(itemId) => addToPlan.mutate({ itemId, source: 'auto' })}
              onRemove={(entryId) => removeFromPlan.mutate(entryId)}
              onToggleDone={toggleDone}
              onPick={() => setPickOpen(true)}
              onPlace={placeEntry}
              menuGroupsFor={menuGroupsFor}
              onDropEvent={handleDropEvent}
            />
          </div>
        )}
      </div>

      {editingItem && (
        <ItemEditModal
          isOpen={!!editingItem}
          onClose={() => {
            setEditingItem(null);
            invalidateAgenda();
          }}
          spaceId={editingItem.spaceId}
          itemId={editingItem.itemId}
          allItems={(spaceItemsData?.data as Item[]) || []}
          canEdit={true}
          onNavigate={(newItemId) => setEditingItem({ ...editingItem, itemId: newItemId })}
        />
      )}

      <CalendarFeedsModal open={feedsOpen} onClose={() => setFeedsOpen(false)} />
      <PickTasksModal
        open={pickOpen} onClose={() => setPickOpen(false)}
        plannedItemIds={new Set((data?.plan ?? []).map((p) => p.itemId))}
        onPick={(itemId) => addToPlan.mutate({ itemId, source: 'manual' })}
        extraFilters={agendaFilters}
      />
    </div>
  );
}

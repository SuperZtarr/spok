/*
 * Page /today « Ma journée » — écran d'atterrissage du matin : grille horaire 7h-20h
 * (réunions ICS/MEETING fixes + blocs de tâches déplaçables, time-blocking) à gauche,
 * liste du jour (tâches non placées + suggestions) à droite.
 * État local uniquement (date affichée, modales) — pas de store Zustand.
 * Le marquage « fait » passe par itemsApi.update (status done) : une seule vérité, l'item.
 * Le placement (plannedStart/plannedDuration) vit sur DayPlanEntry, jamais sur l'item.
 */
import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Item } from '@spok/shared';
import { ItemEditModal } from '@/components/ItemEditModal';
import { buildItemMenuGroups } from '@/lib/itemMenuGroups';
import type { ItemActionGroup } from '@/components/ui/ItemActionMenu';
import { useAgenda, useAgendaMutations, todayKey } from '@/hooks/useAgenda';
import { useGlobalTaskFilters } from '@/hooks/useGlobalTaskFilters';
import { GlobalTaskFilterBar } from '@/components/GlobalTaskFilterBar';
import { itemsApi, type AgendaFilters, type DayPlanEntryDto, type DayPlanItemDto } from '@/lib/api';
import { findFreeSlot, type BusyInterval } from '@/lib/timeblock';
import { DayTimeGrid, type DropPayload } from '@/components/today/DayTimeGrid';
import { DayPlanList } from '@/components/today/DayPlanList';
import { CalendarFeedsModal } from '@/components/today/CalendarFeedsModal';
import { PickTasksModal } from '@/components/today/PickTasksModal';

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function TodayPage() {
  const [date, setDate] = useState(todayKey());
  const [feedsOpen, setFeedsOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  // Filtre global (même barre que Tableau de bord / Tâches) : n'agit que sur les
  // suggestions et la pioche — jamais sur le plan engagé ni la grille.
  const filters = useGlobalTaskFilters();
  const agendaFilters: AgendaFilters = {
    type: filters.queryParams.type,
    spaceId: filters.queryParams.spaceId,
    status: filters.queryParams.status,
    priority: filters.queryParams.priority,
    search: filters.queryParams.search,
  };
  const { data, isLoading } = useAgenda(date, agendaFilters);
  const { addToPlan, removeFromPlan, updateEntry } = useAgendaMutations(date);
  const queryClient = useQueryClient();

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
  const menuGroupsFor = (item: DayPlanItemDto): ItemActionGroup[] =>
    buildItemMenuGroups(item.id, {
      onOpen: () => setEditingItem({ spaceId: item.spaceId, itemId: item.id }),
      onOpenInNewTab: () => window.open(`/spaces/${item.spaceId}/content?item=${item.id}`, '_blank'),
      onEdit: () => setEditingItem({ spaceId: item.spaceId, itemId: item.id }),
      onDelete: async () => {
        if (!window.confirm(`Supprimer « ${item.title} » ?`)) return;
        await itemsApi.delete(item.spaceId, item.id);
        invalidateAgenda();
      },
    }, { canEdit: true, itemSpaceId: item.spaceId });

  // Drop depuis la liste : une tâche engagée est placée, une suggestion est engagée + placée
  const handleDropAt = (payload: DropPayload, startIso: string, durationMin: number) => {
    if (payload.kind === 'entry') {
      updateEntry.mutate({ id: payload.id, plannedStart: startIso, plannedDuration: durationMin });
    } else {
      addToPlan.mutate({ itemId: payload.id, source: 'auto', plannedStart: startIso, plannedDuration: durationMin });
    }
  };

  const placeEntry = (entry: DayPlanEntryDto) => {
    const dayStart = new Date(`${date}T07:00:00`);
    const dayEnd = new Date(`${date}T20:00:00`);
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
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 max-w-7xl mx-auto">
            <div className="min-w-0">
              {(data?.feedErrors?.length ?? 0) > 0 && (
                <p className="mb-2 inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Calendrier(s) injoignable(s) : {data!.feedErrors.map((f) => f.name).join(', ')}
                </p>
              )}
              {(data?.events ?? []).filter((e) => e.allDay).map((e) => (
                <div key={e.id} className="mb-1 flex items-center gap-2 rounded border border-border bg-accent/40 px-2 py-1 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
                  <span className="truncate">{e.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">journée</span>
                </div>
              ))}
              <DayTimeGrid
                date={date}
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

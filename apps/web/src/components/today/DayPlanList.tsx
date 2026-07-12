/*
 * Colonne liste du jour de la page Ma journée : les tâches engagées NON PLACÉES sur la
 * grille (cases à cocher → status 'done' sur l'item, bouton « Placer » → premier créneau
 * libre), puis les suggestions acceptables d'un clic. Les tâches placées vivent dans
 * DayTimeGrid — ici seulement un compteur.
 * Props : plan complet (filtré ici), suggestions, callbacks accept/remove/toggleDone/pick/place.
 * Tâches non placées et suggestions sont draggables (HTML5, dataTransfer JSON
 * {kind:'entry'|'suggestion', id}) vers la colonne Tâches de DayTimeGrid.
 * Ne pas dupliquer ici la logique de tri des suggestions — elle vit côté serveur.
 */
import { Check, Plus, X, ListTodo, CalendarClock } from 'lucide-react';
import { ItemActionMenu } from '@/components/ui/ItemActionMenu';
import type { ItemActionGroup } from '@/components/ui/ItemActionMenu';
import type { DayPlanEntryDto, DayPlanItemDto } from '@/lib/api';

export function DayPlanList({ plan, suggestions, onAccept, onRemove, onToggleDone, onPick, onPlace, menuGroupsFor }: {
  plan: DayPlanEntryDto[];
  suggestions: DayPlanItemDto[];
  onAccept: (itemId: string) => void;
  onRemove: (entryId: string) => void;
  onToggleDone: (item: DayPlanItemDto) => void;
  onPick: () => void;
  onPlace: (entry: DayPlanEntryDto) => void;
  menuGroupsFor: (item: DayPlanItemDto) => ItemActionGroup[];
}) {
  const unplaced = plan.filter((p) => !p.plannedStart);
  const placedCount = plan.length - unplaced.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ListTodo className="w-4 h-4" /> Ma liste du jour
        <button
          onClick={onPick}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus className="w-3.5 h-3.5" /> Piocher
        </button>
      </div>

      {plan.length === 0 && <p className="text-sm text-muted-foreground">Rien d'engagé pour ce jour.</p>}
      {plan.length > 0 && unplaced.length === 0 && (
        <p className="text-sm text-muted-foreground">Tout est placé sur la grille ({placedCount}).</p>
      )}
      {placedCount > 0 && unplaced.length > 0 && (
        <p className="text-xs text-muted-foreground">{placedCount} tâche(s) déjà sur la grille.</p>
      )}
      {unplaced.map((entry) => {
        const done = entry.item.status === 'done';
        return (
          <div
            key={entry.id}
            className="group flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing"
            draggable
            onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'entry', id: entry.id }))}
          >
            <button
              onClick={() => onToggleDone(entry.item)}
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${done ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}
              aria-label={done ? 'Rouvrir' : 'Terminer'}
            >
              {done && <Check className="w-3 h-3" />}
            </button>
            <span className={`truncate ${done ? 'line-through text-muted-foreground' : ''}`}>{entry.item.title}</span>
            <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{entry.item.space.name}</span>
            <button
              onClick={() => onPlace(entry)}
              className="inline-flex items-center gap-1 h-6 px-1.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0"
              title="Placer sur la grille (premier créneau libre)"
            >
              <CalendarClock className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onRemove(entry.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" aria-label="Retirer">
              <X className="w-3.5 h-3.5" />
            </button>
            <ItemActionMenu groups={menuGroupsFor(entry.item)} />
          </div>
        );
      })}

      {suggestions.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Suggestions</div>
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'suggestion', id: s.id }))}
            >
              <span className="truncate">{s.title}</span>
              {s.dueDate && <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(s.dueDate).toLocaleDateString('fr-FR')}</span>}
              <button
                onClick={() => onAccept(s.id)}
                className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
              <ItemActionMenu groups={menuGroupsFor(s)} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

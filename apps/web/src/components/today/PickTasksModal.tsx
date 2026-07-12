/*
 * Modale « Piocher » de la page Ma journée : vivier de mes tâches ouvertes
 * (réutilise userTasksApi — même source que la page Tâches globales), recherche texte,
 * clic = ajout au plan du jour. Hérite du filtre global de la page via extraFilters
 * (espaces, statuts, priorités) ; la recherche locale prime sur celle du filtre.
 * Ne pas réimplémenter de filtres avancés ici : pour du tri fin, la page /tasks reste l'outil.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { userTasksApi, type AgendaFilters } from '@/lib/api';

export function PickTasksModal({ open, onClose, plannedItemIds, onPick, extraFilters }: {
  open: boolean;
  onClose: () => void;
  plannedItemIds: Set<string>;
  onPick: (itemId: string) => void;
  extraFilters?: AgendaFilters;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['pick-tasks', search, extraFilters ?? {}],
    queryFn: () => userTasksApi.list({
      myTasks: true,
      spaceId: extraFilters?.spaceId,
      status: extraFilters?.status,
      priority: extraFilters?.priority,
      search: search || extraFilters?.search || undefined,
      sortBy: 'dueDate', sortDir: 'asc', pageSize: 50,
    }),
    enabled: open,
  });
  if (!open) return null;
  const tasks = (data?.data ?? []).filter((t) => !plannedItemIds.has(t.id) && t.status !== 'done' && t.status !== 'cancelled');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-lg border border-border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Piocher dans mes tâches</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…" className="h-8 rounded border border-input bg-background px-2 text-sm mb-2"
        />
        <div className="flex-1 overflow-auto flex flex-col gap-1">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && tasks.length === 0 && <p className="text-sm text-muted-foreground">Rien à piocher.</p>}
          {tasks.map((t) => (
            <button
              key={t.id} onClick={() => onPick(t.id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
              <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{t.spaceName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

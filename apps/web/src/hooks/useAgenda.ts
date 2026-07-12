/*
 * Hook de la page Ma journée : agenda du jour (queryKey ['agenda', date]) + mutations
 * plan du jour et feeds. Les bornes from/to sont calculées ICI, dans le fuseau du
 * navigateur — ne jamais déplacer ce calcul côté serveur.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendaApi, type AgendaFilters } from '@/lib/api';

/** Bornes [minuit local, minuit local +1j[ pour une date YYYY-MM-DD, en ISO UTC. */
export function dayBounds(date: string): { from: string; to: string } {
  const [y, m, d] = date.split('-').map(Number);
  const from = new Date(y, m - 1, d);
  const to = new Date(y, m - 1, d + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Date locale du jour au format YYYY-MM-DD (clé du plan). */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useAgenda(date: string, filters?: AgendaFilters) {
  const { from, to } = dayBounds(date);
  return useQuery({
    queryKey: ['agenda', date, filters ?? {}],
    queryFn: () => agendaApi.get(date, from, to, filters),
    enabled: !!date,
    staleTime: 60_000,
  });
}

export function useAgendaMutations(date: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['agenda', date] });
  const addToPlan = useMutation({
    mutationFn: (p: { itemId: string; source: 'auto' | 'manual' }) => agendaApi.addToPlan({ date, ...p }),
    onSuccess: invalidate,
  });
  const removeFromPlan = useMutation({ mutationFn: agendaApi.removeFromPlan, onSuccess: invalidate });
  const updateEntry = useMutation({
    mutationFn: (p: { id: string; position?: number; plannedStart?: string | null; plannedDuration?: number }) => {
      const { id, ...data } = p;
      return agendaApi.updatePlanEntry(id, data);
    },
    onSuccess: invalidate,
  });
  return { addToPlan, removeFromPlan, updateEntry };
}

export function useCalendarFeeds() {
  return useQuery({ queryKey: ['calendar-feeds'], queryFn: agendaApi.listFeeds });
}

export function useCalendarFeedMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-feeds'] });
    queryClient.invalidateQueries({ queryKey: ['agenda'] });
  };
  const createFeed = useMutation({ mutationFn: agendaApi.createFeed, onSuccess: invalidate });
  const updateFeed = useMutation({
    mutationFn: (p: { id: string; name?: string; url?: string; color?: string; enabled?: boolean }) => {
      const { id, ...data } = p;
      return agendaApi.updateFeed(id, data);
    },
    onSuccess: invalidate,
  });
  const deleteFeed = useMutation({ mutationFn: agendaApi.deleteFeed, onSuccess: invalidate });
  return { createFeed, updateFeed, deleteFeed };
}

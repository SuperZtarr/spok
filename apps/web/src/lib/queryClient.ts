/*
 * Client React Query unique de l'application (fourni par main.tsx via QueryClientProvider).
 * Exporté pour les rares actions hors composant qui doivent rafraîchir le cache — ex. « Marquer comme
 * non lu » déclenché depuis les menus contextuels construits par lib/itemMenuGroups (fonction pure).
 * Dans un composant React, utiliser useQueryClient() plutôt que cet import.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes — keep cache alive longer
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

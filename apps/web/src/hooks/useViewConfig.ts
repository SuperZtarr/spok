/*
 * Hook : config des vues (AppConfig) — système parallèle utilisé par ViewModeSelector, composant
 * non rendu (remplacé par MainMenu). Conservé pour /admin/views. Cf. skill spok-menu.
 */
import { useQuery } from '@tanstack/react-query';
import { configApi } from '../lib/api';
import { DEFAULT_VIEW_CONFIG, DEFAULT_VIEW_CATEGORIES } from '@spok/shared';
import type { ViewAccess } from '@spok/shared';
import { useAuthStore } from '../stores/auth';
import { useAdminMode } from '../components/DevDbStatus';

export function useViewConfig() {
  const user = useAuthStore(s => s.user);
  const adminMode = useAdminMode();

  const { data } = useQuery({
    queryKey: ['view-config'],
    queryFn: configApi.getViews,
    staleTime: 5 * 60 * 1000, // 5 min
    placeholderData: { views: DEFAULT_VIEW_CONFIG, categories: DEFAULT_VIEW_CATEGORIES },
  });

  const allViews = data?.views || DEFAULT_VIEW_CONFIG;
  const categories = data?.categories || DEFAULT_VIEW_CATEGORIES;

  // Filter views based on user access level — admin views only when admin mode is active
  const userAccess: ViewAccess = adminMode ? 'admin' : user ? 'user' : 'public';
  const accessOrder: Record<ViewAccess, number> = { public: 0, user: 1, admin: 2 };

  const views = allViews
    .filter(v => v.visible && accessOrder[v.access] <= accessOrder[userAccess])
    .sort((a, b) => a.order - b.order);

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return { views, categories: sortedCategories, allViews };
}

import { useQuery } from '@tanstack/react-query';
import { configApi } from '../lib/api';
import { DEFAULT_GLOBAL_PAGES, DEFAULT_GLOBAL_PAGE_GROUPS } from '@spok/shared';
import type { ViewAccess } from '@spok/shared';
import { useAuthStore } from '../stores/auth';

export function useGlobalPages() {
  const user = useAuthStore(s => s.user);

  const { data } = useQuery({
    queryKey: ['global-pages-config'],
    queryFn: configApi.getGlobalPages,
    staleTime: 5 * 60 * 1000,
    placeholderData: { pages: DEFAULT_GLOBAL_PAGES, groups: DEFAULT_GLOBAL_PAGE_GROUPS },
  });

  const allPages = data?.pages || DEFAULT_GLOBAL_PAGES;
  const groups = data?.groups || DEFAULT_GLOBAL_PAGE_GROUPS;

  const userAccess: ViewAccess = user?.globalRole === 'ADMIN' ? 'admin' : user ? 'user' : 'public';
  const accessOrder: Record<ViewAccess, number> = { public: 0, user: 1, admin: 2 };

  const pages = allPages
    .filter(p => p.visible && accessOrder[p.access] <= accessOrder[userAccess])
    .sort((a, b) => a.order - b.order);

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  return { pages, groups: sortedGroups, allPages };
}

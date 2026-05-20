import { useQuery } from '@tanstack/react-query';
import { menuApi } from '../lib/api';
import { MENU_REGISTRY } from '@spok/shared';
import type { MenuItemConfig, MenuAccess, MenuSection } from '@spok/shared';
import { useAuthStore } from '../stores/auth';
import { useAdminMode } from '../components/DevDbStatus';

export function useMenuItems() {
  const user = useAuthStore(s => s.user);
  const adminMode = useAdminMode();

  const { data } = useQuery({
    queryKey: ['menu-items'],
    queryFn: menuApi.getAll,
    staleTime: 5 * 60 * 1000,
    placeholderData: MENU_REGISTRY,
  });

  const allItems = (data || MENU_REGISTRY) as MenuItemConfig[];

  // Filter by access level — admin items only visible when admin mode is active
  const userAccess: MenuAccess = adminMode ? 'admin' : user ? 'user' : 'public';
  const accessOrder: Record<MenuAccess, number> = { public: 0, user: 1, admin: 2 };

  const visibleItems = allItems
    .filter(item => item.visible && accessOrder[item.access] <= accessOrder[userAccess])
    .sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order);

  // Group into sections
  const sectionsMap = new Map<string, MenuSection>();
  for (const item of visibleItems) {
    if (!sectionsMap.has(item.section)) {
      sectionsMap.set(item.section, {
        id: item.section,
        label: item.sectionLabel,
        order: item.sectionOrder,
        items: [],
      });
    }
    sectionsMap.get(item.section)!.items.push(item);
  }
  const sections = Array.from(sectionsMap.values()).sort((a, b) => a.order - b.order);

  // Convenience: space views only (items with viewMode)
  const spaceViews = visibleItems.filter(item => item.viewMode);

  // Convenience: space view sections (basic, planning, exploration)
  const spaceViewSections = sections.filter(s => ['basic', 'itemTypes', 'planning', 'exploration'].includes(s.id));

  // Convenience: global pages (items with route in global section)
  const globalPages = visibleItems.filter(item => item.section === 'global');

  return { allItems, visibleItems, sections, spaceViews, spaceViewSections, globalPages };
}

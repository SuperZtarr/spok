import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTab = 'spaces' | 'graph' | 'sunburst' | 'mindmap';

export const DASHBOARD_TABS: {
  value: DashboardTab;
  label: string;
  icon: string;
}[] = [
  { value: 'spaces', label: 'Espaces', icon: 'FolderKanban' },
  { value: 'graph', label: 'Graphe global', icon: 'Network' },
  { value: 'sunburst', label: 'Sunburst', icon: 'CircleDot' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'GitBranch' },
];

// Navigation items (not real tabs — they navigate to a different route)
export const DASHBOARD_NAV_ITEMS: {
  label: string;
  icon: string;
  route: string;
}[] = [
  { label: 'Mes tâches', icon: 'CheckSquare', route: '/tasks' },
];

interface DashboardTabState {
  tab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
}

export const useDashboardTabStore = create<DashboardTabState>()(
  persist(
    (set) => ({
      tab: 'spaces',
      setTab: (tab) => set({ tab }),
    }),
    {
      name: 'dashboard-tab-storage',
    }
  )
);

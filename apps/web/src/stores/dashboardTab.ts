import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTab = 'communities' | 'spaces' | 'sunburst' | 'mindmap' | 'graph' | 'planning';

export type DashboardGroup = 'global' | 'myActivities';

export const DASHBOARD_TABS: {
  value: DashboardTab;
  label: string;
  icon: string;
  group: DashboardGroup;
}[] = [
  { value: 'communities', label: 'Communautés', icon: 'Users', group: 'global' },
  { value: 'spaces', label: 'Espaces', icon: 'FolderKanban', group: 'global' },
  { value: 'sunburst', label: 'Sunburst', icon: 'CircleDot', group: 'global' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'GitBranch', group: 'global' },
  { value: 'graph', label: 'Graphe global', icon: 'Network', group: 'global' },
  { value: 'planning', label: 'Tableau de bord', icon: 'LayoutDashboard', group: 'myActivities' },
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

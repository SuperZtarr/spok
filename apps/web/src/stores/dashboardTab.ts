import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTab = 'communities' | 'spaces' | 'sunburst' | 'mindmap' | 'graph' | 'tasks' | 'deadlines' | 'planning';

export const DASHBOARD_TABS: {
  value: DashboardTab;
  label: string;
  icon: string;
  separator?: boolean;
}[] = [
  { value: 'communities', label: 'Communautés', icon: 'Users' },
  { value: 'spaces', label: 'Espaces', icon: 'FolderKanban' },
  { value: 'sunburst', label: 'Sunburst', icon: 'CircleDot' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'GitBranch' },
  { value: 'graph', label: 'Graphe global', icon: 'Network' },
  { value: 'tasks', label: 'Mes tâches', icon: 'CheckSquare', separator: true },
  { value: 'deadlines', label: 'Mes échéances', icon: 'CalendarCheck' },
  { value: 'planning', label: 'Mon planning', icon: 'Calendar' },
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

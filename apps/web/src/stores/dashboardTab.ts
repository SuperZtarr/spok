/*
 * Store Zustand : onglet actif de la page d'accueil/dashboard (spaces, communities, graph...).
 * DASHBOARD_TABS est un fallback statique — la liste réelle vient de la config des menus.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTab = 'home' | 'communities' | 'spaces' | 'sunburst' | 'mindmap' | 'graph' | 'dashboard' | 'planning';

export type DashboardGroup = 'global' | 'myActivities';

// Legacy static list — kept as fallback only
export const DASHBOARD_TABS: {
  value: DashboardTab;
  label: string;
  icon: string;
  group: DashboardGroup;
}[] = [
  { value: 'home', label: 'Accueil', icon: 'Home', group: 'global' },
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
      tab: 'home',
      setTab: (tab) => set({ tab }),
    }),
    {
      name: 'dashboard-tab-storage',
    }
  )
);

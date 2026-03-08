import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'tree' | 'sequence' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'calendar' | 'graph' | 'text' | 'sunburst' | 'relations' | 'schema' | 'bubble' | 'radialTree' | 'treemap' | 'burndown' | 'orgchart';

export type ViewCategory = 'dashboard' | 'basic' | 'planning' | 'exploration';

export const VIEW_CATEGORIES: { value: ViewCategory; label: string }[] = [
  { value: 'dashboard', label: 'Tableau de bord' },
  { value: 'basic', label: 'Basique' },
  { value: 'planning', label: 'Planification' },
  { value: 'exploration', label: 'Exploration' },
];

export const VIEW_MODES: { value: ViewMode; label: string; icon: string; category: ViewCategory }[] = [
  { value: 'list', label: 'Liste', icon: 'List', category: 'basic' },
  { value: 'tree', label: 'Arborescence', icon: 'GitBranch', category: 'basic' },
  { value: 'kanban', label: 'Kanban', icon: 'Columns3', category: 'basic' },
  { value: 'text', label: 'Texte', icon: 'FileText', category: 'basic' },
  { value: 'planning', label: 'Planning', icon: 'CalendarCheck', category: 'planning' },
  { value: 'timeline', label: 'Gantt', icon: 'GanttChart', category: 'planning' },
  { value: 'calendar', label: 'Calendrier', icon: 'Calendar', category: 'planning' },
  { value: 'sequence', label: 'Séquence', icon: 'ArrowDownUp', category: 'planning' },
  { value: 'types', label: 'Types', icon: 'LayoutGrid', category: 'planning' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'Share2', category: 'exploration' },
  { value: 'graph', label: 'Graphe', icon: 'Network', category: 'exploration' },
  { value: 'sunburst', label: 'Sunburst', icon: 'CircleDot', category: 'exploration' },
  { value: 'relations', label: 'Relations', icon: 'Waypoints', category: 'exploration' },
  { value: 'schema', label: 'Schéma', icon: 'PenTool', category: 'exploration' },
  { value: 'bubble', label: 'Bulles', icon: 'Circle', category: 'exploration' },
  { value: 'radialTree', label: 'Arbre radial', icon: 'Orbit', category: 'exploration' },
  { value: 'treemap', label: 'Treemap', icon: 'SquareStack', category: 'exploration' },
  { value: 'burndown', label: 'Burndown', icon: 'TrendingDown', category: 'planning' },
  { value: 'orgchart', label: 'Organigramme', icon: 'Users', category: 'basic' },
];

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'tree',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'view-mode-storage',
    }
  )
);

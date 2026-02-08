import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'tree' | 'sequence' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'graph';

export const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: 'list', label: 'Liste', icon: 'List' },
  { value: 'tree', label: 'Arborescence', icon: 'GitBranch' },
  { value: 'sequence', label: 'Séquence', icon: 'ArrowDownUp' },
  { value: 'kanban', label: 'Kanban', icon: 'Columns3' },
  { value: 'types', label: 'Types', icon: 'LayoutGrid' },
  { value: 'planning', label: 'Planning', icon: 'CalendarCheck' },
  { value: 'timeline', label: 'Gantt', icon: 'GanttChart' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'Share2' },
  { value: 'graph', label: 'Graphe', icon: 'Network' },
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

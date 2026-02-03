import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'tree' | 'sequence' | 'mindmap' | 'kanban' | 'types';

export const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: 'list', label: 'Liste', icon: 'List' },
  { value: 'tree', label: 'Arborescence', icon: 'GitBranch' },
  { value: 'sequence', label: 'Séquence', icon: 'ArrowDownUp' },
  { value: 'kanban', label: 'Kanban', icon: 'Columns3' },
  { value: 'types', label: 'Types', icon: 'LayoutGrid' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'Share2' },
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

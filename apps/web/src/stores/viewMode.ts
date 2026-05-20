import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VIEW_REGISTRY } from '@spok/shared';

export type ViewMode = 'list' | 'tree' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'calendar' | 'graph' | 'text' | 'sunburst' | 'relations' | 'bubble' | 'radialTree' | 'treemap' | 'burndown' | 'cfd' | 'chord' | 'crossTable' | 'heatmap' | 'ego' | 'members' | 'priority' | 'images' | 'links' | 'documents' | 'bugs' | 'thread' | 'overview' | 'todo' | 'recent' | 'pert';

export type ViewCategory = 'dashboard' | 'basic' | 'itemTypes' | 'planning' | 'exploration';

export const VIEWER_ALLOWED_VIEWS: ViewMode[] = ['overview', 'list', 'kanban', 'timeline', 'mindmap'];

export const VIEW_CATEGORIES: { value: ViewCategory; label: string }[] = [
  { value: 'dashboard', label: 'Tableau de bord' },
  { value: 'basic', label: 'Basique' },
  { value: 'itemTypes', label: 'Types' },
  { value: 'planning', label: 'Planification' },
  { value: 'exploration', label: 'Exploration' },
];

export const VIEW_MODES: { value: ViewMode; label: string; icon: string; category: ViewCategory }[] =
  VIEW_REGISTRY.map(v => ({ value: v.id as ViewMode, label: v.label, icon: v.icon, category: v.category as ViewCategory }));

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  allowedViews: ViewMode[] | null;
  setAllowedViews: (views: ViewMode[] | null) => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'tree',
      setMode: (mode) => set({ mode }),
      allowedViews: null,
      setAllowedViews: (allowedViews) => set({ allowedViews }),
    }),
    {
      name: 'view-mode-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

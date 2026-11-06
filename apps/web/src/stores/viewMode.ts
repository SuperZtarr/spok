/*
 * Store Zustand : vue active d'un espace (ViewMode).
 * Les définitions des vues viennent de VIEW_REGISTRY (@spok/shared) — ne pas dupliquer ici.
 * Le droit de modifier ne limite pas les vues (décision Thomas 2026-11-06) : toutes sont proposées en lecture seule,
 * chaque vue masque ses actions d'écriture via canEdit. Ne pas réintroduire de liste de vues par rôle ;
 * l'accès à une vue se règle dans /admin/views (useMenuItems).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VIEW_REGISTRY } from '@spok/shared';

export type ViewMode = 'list' | 'tree' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'calendar' | 'graph' | 'text' | 'sunburst' | 'relations' | 'bubble' | 'radialTree' | 'treemap' | 'burndown' | 'cfd' | 'chord' | 'crossTable' | 'heatmap' | 'ego' | 'loupe' | 'members' | 'priority' | 'images' | 'links' | 'documents' | 'articles' | 'bugs' | 'thread' | 'overview' | 'todo' | 'recent' | 'pert' | 'process';

export type ViewCategory = 'dashboard' | 'basic' | 'itemTypes' | 'planning' | 'exploration';

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
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'tree',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'view-mode-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

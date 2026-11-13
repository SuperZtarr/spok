/*
 * Store Zustand : vue active d'un espace (ViewMode).
 * Les définitions des vues viennent de VIEW_REGISTRY (@spok/shared) — ne pas dupliquer ici.
 * Le droit de modifier ne limite pas les vues (décision Thomas 2026-11-06) : toutes sont proposées en lecture seule,
 * chaque vue masque ses actions d'écriture via canEdit. Ne pas réintroduire de liste de vues par rôle ;
 * l'accès à une vue se règle dans /admin/views (useMenuItems).
 * ViewMode : union écrite à la main, à compléter pour chaque vue du registre (tags ajoutée, bugs retirée le 2026-11-11,
 * overview retirée le 2026-11-13).
 * Catégories : dérivées de SPACE_VIEW_SECTIONS (@spok/shared, 5 catégories depuis 2026-11-13), plus « dashboard ».
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VIEW_REGISTRY, SPACE_VIEW_SECTIONS, type ViewCategoryId } from '@spok/shared';

export type ViewMode = 'list' | 'tree' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'calendar' | 'graph' | 'text' | 'sunburst' | 'relations' | 'bubble' | 'radialTree' | 'treemap' | 'burndown' | 'cfd' | 'chord' | 'crossTable' | 'heatmap' | 'ego' | 'loupe' | 'members' | 'priority' | 'images' | 'links' | 'documents' | 'articles' | 'tags' | 'thread' | 'todo' | 'recent' | 'pert' | 'process';

export type ViewCategory = 'dashboard' | ViewCategoryId;

export const VIEW_CATEGORIES: { value: ViewCategory; label: string }[] = [
  { value: 'dashboard', label: 'Tableau de bord' },
  ...SPACE_VIEW_SECTIONS.map((s) => ({ value: s.id as ViewCategory, label: s.label })),
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

/*
 * Store Zustand : vue active d'un espace (ViewMode).
 * Les définitions des vues viennent de VIEW_REGISTRY (@spok/shared) — ne pas dupliquer ici.
 * Le droit de modifier ne limite pas les vues (décision Thomas 2026-11-06) : toutes sont proposées en lecture seule,
 * chaque vue masque ses actions d'écriture via canEdit. Ne pas réintroduire de liste de vues par rôle ;
 * l'accès à une vue se règle dans /admin/views (useMenuItems).
 * ViewMode : alias de ViewId, dérivé de VIEW_REGISTRY (@spok/shared, centralisation des référentiels 2026-11-13) —
 * plus d'union écrite à la main : ajouter une vue = une entrée du registre.
 * Catégories : celles du registre (ViewCategoryId) ; libellés dans SPACE_VIEW_SECTIONS (@spok/shared). VIEW_CATEGORIES
 * (copie locale avec une fausse catégorie « dashboard », lue par son seul test) supprimée le 2026-11-18.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VIEW_REGISTRY, type ViewCategoryId, type ViewId } from '@spok/shared';

export type ViewMode = ViewId;

export const VIEW_MODES: { value: ViewMode; label: string; icon: string; category: ViewCategoryId }[] =
  VIEW_REGISTRY.map(v => ({ value: v.id as ViewMode, label: v.label, icon: v.icon, category: v.category }));

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

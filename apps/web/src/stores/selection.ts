/*
 * Store Zustand : sélection multiple d'items (mode sélection des vues liste/kanban).
 * Set d'ids + actions toggle/select/clear — état volatil, non persisté.
 */
import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
  isSelectionMode: boolean;

  // Actions
  toggleSelection: (id: string) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleSelectionMode: () => void;
  setSelectionMode: (enabled: boolean) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set(),
  isSelectionMode: false,

  toggleSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedIds: newSet };
    }),

  selectItem: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.add(id);
      return { selectedIds: newSet };
    }),

  deselectItem: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.delete(id);
      return { selectedIds: newSet };
    }),

  selectAll: (ids) =>
    set({ selectedIds: new Set(ids) }),

  clearSelection: () =>
    set({ selectedIds: new Set(), isSelectionMode: false }),

  toggleSelectionMode: () =>
    set((state) => ({
      isSelectionMode: !state.isSelectionMode,
      selectedIds: state.isSelectionMode ? new Set() : state.selectedIds,
    })),

  setSelectionMode: (enabled) =>
    set({ isSelectionMode: enabled, selectedIds: enabled ? new Set() : new Set() }),
}));

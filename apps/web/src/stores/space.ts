import { create } from 'zustand';
import type { SpaceWithRole } from '@spok/shared';

const STORAGE_KEY = 'spok:includeChildrenSpaceIds';

function loadPersistedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function persistIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

interface SpaceState {
  currentSpace: SpaceWithRole | null;
  setCurrentSpace: (space: SpaceWithRole | null) => void;
  // Spaces whose child-space items should be included in views
  includeChildrenSpaceIds: Set<string>;
  toggleIncludeChildren: (spaceId: string, descendantIds?: string[]) => void;
}

export const useSpaceStore = create<SpaceState>()((set) => ({
  currentSpace: null,
  setCurrentSpace: (space) => set({ currentSpace: space }),
  includeChildrenSpaceIds: loadPersistedIds(),
  toggleIncludeChildren: (spaceId: string, descendantIds?: string[]) => set((state) => {
    const next = new Set(state.includeChildrenSpaceIds);
    const allIds = [spaceId, ...(descendantIds || [])];
    if (next.has(spaceId)) {
      for (const id of allIds) next.delete(id);
    } else {
      for (const id of allIds) next.add(id);
    }
    persistIds(next);
    return { includeChildrenSpaceIds: next };
  }),
}));

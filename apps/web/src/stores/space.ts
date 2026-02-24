import { create } from 'zustand';
import type { SpaceWithRole } from '@spok/shared';

interface SpaceState {
  currentSpace: SpaceWithRole | null;
  setCurrentSpace: (space: SpaceWithRole | null) => void;
  // Spaces whose child-space items should be included in views
  includeChildrenSpaceIds: Set<string>;
  toggleIncludeChildren: (spaceId: string) => void;
}

export const useSpaceStore = create<SpaceState>()((set) => ({
  currentSpace: null,
  setCurrentSpace: (space) => set({ currentSpace: space }),
  includeChildrenSpaceIds: new Set<string>(),
  toggleIncludeChildren: (spaceId: string) => set((state) => {
    const next = new Set(state.includeChildrenSpaceIds);
    if (next.has(spaceId)) {
      next.delete(spaceId);
    } else {
      next.add(spaceId);
    }
    return { includeChildrenSpaceIds: next };
  }),
}));

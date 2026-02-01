import { create } from 'zustand';
import type { SpaceWithRole } from '@spok/shared';

interface SpaceState {
  currentSpace: SpaceWithRole | null;
  setCurrentSpace: (space: SpaceWithRole | null) => void;
}

export const useSpaceStore = create<SpaceState>()((set) => ({
  currentSpace: null,
  setCurrentSpace: (space) => set({ currentSpace: space }),
}));

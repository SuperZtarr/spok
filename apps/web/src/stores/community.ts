/*
 * Store Zustand : communauté courante (avec rôle), persistée pour survivre aux rechargements.
 * Utilisé par le layout et les pages communauté pour le contexte de navigation.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CommunityWithRole } from '@spok/shared';

interface CommunityState {
  currentCommunity: CommunityWithRole | null;
  setCurrentCommunity: (community: CommunityWithRole | null) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set) => ({
      currentCommunity: null,
      setCurrentCommunity: (community) => set({ currentCommunity: community }),
    }),
    {
      name: 'community-storage',
    }
  )
);

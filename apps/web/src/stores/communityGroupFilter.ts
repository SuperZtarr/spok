/*
 * Store Zustand : groupe de communautés actif (filtre de la sidebar et de la liste des communautés, 2026-11-27).
 * Valeur : 'all' (toutes), 'ungrouped' (non classées) ou l'id d'un groupe personnel (CommunityGroup).
 * Partagé par la sidebar (Layout) et /communities (CommunityListView) : changer l'un change l'autre.
 * Persisté dans le navigateur (localStorage, propre à l'appareil). Un id de groupe supprimé est traité comme 'all'
 * par lib/communityGroupFilter.ts — ne pas le corriger ici.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CommunityGroupFilterValue = 'all' | 'ungrouped' | string;

interface CommunityGroupFilterState {
  active: CommunityGroupFilterValue;
  setActive: (value: CommunityGroupFilterValue) => void;
}

export const useCommunityGroupFilterStore = create<CommunityGroupFilterState>()(
  persist(
    (set) => ({
      active: 'all',
      setActive: (active) => set({ active }),
    }),
    { name: 'spok-community-group-filter' },
  ),
);

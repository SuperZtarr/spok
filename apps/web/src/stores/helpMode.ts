/*
 * Store du mode Aide (aide utilisateur, phase 4) : actif ou non — état volatil, non persisté (recharger quitte le mode).
 * enter() refuse de démarrer pendant un tour guidé driver.js (popover affiché). Lu par HelpModeOverlay (interception,
 * encadré, bandeau) et HelpButton (bouton « Mode Aide »). Ne pas y mettre l'état de survol : il reste local à l'overlay.
 */
import { create } from 'zustand';

interface HelpModeState {
  active: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const tourRunning = () => typeof document !== 'undefined' && !!document.querySelector('.driver-popover');

export const useHelpModeStore = create<HelpModeState>((set, get) => ({
  active: false,
  enter: () => { if (!tourRunning()) set({ active: true }); },
  exit: () => set({ active: false }),
  toggle: () => (get().active ? get().exit() : get().enter()),
}));

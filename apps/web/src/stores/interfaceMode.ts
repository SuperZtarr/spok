/**
 * Store du mode d'interface global.
 * Contrôle quelles vues et quels champs sont visibles selon le contexte d'usage :
 * - 'forum'      : axé discussion, sans données de pilotage
 * - 'projet'     : pilotage complet, toutes vues et champs
 * - 'exploration': tout exposé, pour l'analyse et la réflexion
 * Persisté en localStorage pour survivre aux rechargements.
 */
import { create } from 'zustand';

export type InterfaceMode = 'forum' | 'projet' | 'exploration' | 'tous';

interface InterfaceModeState {
  mode: InterfaceMode;
  setMode: (mode: InterfaceMode) => void;
}

const STORAGE_KEY = 'spok-interface-mode';

function loadMode(): InterfaceMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'forum' || stored === 'projet' || stored === 'exploration' || stored === 'tous') return stored;
  } catch {}
  return 'projet';
}

export const useInterfaceModeStore = create<InterfaceModeState>()((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
    set({ mode });
  },
}));

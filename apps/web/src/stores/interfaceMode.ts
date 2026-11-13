/**
 * Store du mode d'interface — contexte de la communauté visitée + surcharge manuelle
 * (spec 2026-07-15-community-context-mode, bascule utilisateur réintroduite le 2026-09-27).
 * Les modes eux-mêmes (libellés, contextes, favoris, vue d'ouverture, pages masquées, fiche réduite) sont définis
 * UNE fois dans MODE_REGISTRY (@spok/shared, constants/modeRegistry.ts, 2026-11-13) : ce fichier ne garde que l'état
 * et des dérivés, jamais une liste de modes.
 * - contextMode = mode dérivé du contexte de la communauté (modeForContext du registre ; neutre / hors communauté → Tous)
 * - mode = mode effectif lu par toute l'app (GlobalNavBar, SpaceViewSelector, ItemEditModal…)
 * Écrivains :
 * - applyContextMode : Layout.tsx UNIQUEMENT, au changement de communauté (id ou contexte) —
 *   réaligne mode sur le contexte et efface le choix manuel.
 * - chooseMode : boutons d'option du header (Layout.tsx) — surcharge valable tant qu'on reste
 *   dans la même communauté. Volontairement non persistée (pas de localStorage).
 */
import { create } from 'zustand';
import { MODE_REGISTRY, DEFAULT_INTERFACE_MODE, modeForContext, type InterfaceMode } from '@spok/shared';

export type { InterfaceMode };
export { modeForContext };

/** Libellés des modes, dérivés du registre (en-tête, nom devant les favoris). */
export const INTERFACE_MODE_LABELS = Object.fromEntries(MODE_REGISTRY.map((m) => [m.id, m.label])) as Record<InterfaceMode, string>;

interface InterfaceModeState {
  mode: InterfaceMode;
  contextMode: InterfaceMode;
  applyContextMode: (mode: InterfaceMode) => void;
  chooseMode: (mode: InterfaceMode) => void;
}

export const useInterfaceModeStore = create<InterfaceModeState>()((set) => ({
  mode: DEFAULT_INTERFACE_MODE,
  contextMode: DEFAULT_INTERFACE_MODE,
  applyContextMode: (mode) => set({ mode, contextMode: mode }),
  chooseMode: (mode) => set({ mode }),
}));

/**
 * Items de navigation globale masqués par mode, dérivés du registre (globalExcluded) — consommé par GlobalNavBar
 * (bandeau desktop) ET par la grille de nav mobile de Layout.
 */
export const MODE_GLOBAL_EXCLUDED = Object.fromEntries(
  MODE_REGISTRY.map((m) => [m.id, new Set<string>(m.globalExcluded)]),
) as Record<InterfaceMode, Set<string>>;

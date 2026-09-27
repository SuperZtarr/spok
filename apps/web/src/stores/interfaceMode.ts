/**
 * Store du mode d'interface — contexte de la communauté visitée + surcharge manuelle
 * (spec 2026-07-15-community-context-mode, bascule utilisateur réintroduite le 2026-09-27) :
 * - contextMode = mode par défaut dérivé du contexte de la communauté :
 *     FORUM → 'forum', PROJECT → 'projet', hors communauté / contexte neutre → 'tous'
 * - mode = mode effectif lu par toute l'app (GlobalNavBar, SpaceToolbar, ItemEditModal…)
 * Écrivains :
 * - applyContextMode : Layout.tsx UNIQUEMENT, au changement de communauté (id ou contexte) —
 *   réaligne mode sur le contexte et efface le choix manuel.
 * - chooseMode : boutons d'option du header (Layout.tsx) — surcharge valable tant qu'on reste
 *   dans la même communauté. Volontairement non persistée (pas de localStorage).
 * 'exploration' : réservé, ni dérivé ni proposé en bouton pour l'instant (chantier « loupe »).
 */
import { create } from 'zustand';

export type InterfaceMode = 'forum' | 'projet' | 'exploration' | 'tous';

interface InterfaceModeState {
  mode: InterfaceMode;
  contextMode: InterfaceMode;
  applyContextMode: (mode: InterfaceMode) => void;
  chooseMode: (mode: InterfaceMode) => void;
}

export const useInterfaceModeStore = create<InterfaceModeState>()((set) => ({
  mode: 'tous',
  contextMode: 'tous',
  applyContextMode: (mode) => set({ mode, contextMode: mode }),
  chooseMode: (mode) => set({ mode }),
}));

/**
 * Items de navigation globale masqués par mode — consommé par GlobalNavBar (bandeau desktop)
 * ET par la grille de nav mobile de Layout : toute évolution doit rester commune aux deux.
 */
export const MODE_GLOBAL_EXCLUDED: Record<InterfaceMode, Set<string>> = {
  forum:       new Set(['global-graph', 'global-sunburst', 'global-links', 'global-mindmap', 'dashboard', 'tasks', 'activity', 'today']),
  projet:      new Set(['global-sunburst', 'global-mindmap', 'global-graph', 'global-links']),
  exploration: new Set(['dashboard', 'tasks', 'activity', 'today']),
  tous:        new Set(),
};

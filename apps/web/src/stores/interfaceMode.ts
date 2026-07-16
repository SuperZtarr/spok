/**
 * Store du mode d'interface — VALEUR DÉRIVÉE depuis le contexte de la communauté visitée
 * (spec 2026-07-15-community-context-mode) :
 * - communauté context FORUM   → 'forum'      (vues discussion, sans données de pilotage)
 * - communauté context PROJECT → 'projet'     (pilotage complet)
 * - partout ailleurs           → 'tous'       (neutre : espace perso, pages globales)
 * - 'exploration' : réservé, non dérivé pour l'instant (chantier à venir).
 * La dérivation est poussée par Layout.tsx (seul écrivain via setMode) — ne pas ajouter
 * de persistance localStorage ni de bascule utilisateur : le contenu dicte l'interface.
 */
import { create } from 'zustand';

export type InterfaceMode = 'forum' | 'projet' | 'exploration' | 'tous';

interface InterfaceModeState {
  mode: InterfaceMode;
  setMode: (mode: InterfaceMode) => void;
}

export const useInterfaceModeStore = create<InterfaceModeState>()((set) => ({
  mode: 'tous',
  setMode: (mode) => set({ mode }),
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

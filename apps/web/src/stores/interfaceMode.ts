/**
 * Store du mode d'interface — contexte de la communauté visitée + surcharge manuelle
 * (spec 2026-07-15-community-context-mode, bascule utilisateur réintroduite le 2026-09-27) :
 * - contextMode = mode par défaut dérivé du contexte de la communauté :
 *     FORUM → 'forum', PROJECT → 'projet', JDR → 'loisirs', DOCUMENTATION → 'documentation',
 *     EXPLORATION → 'exploration', hors communauté / contexte neutre → 'tous' (CONTEXT_INTERFACE_MODE)
 *   Le mode Loisirs (activités ludiques, ex-JDR, renommé le 2026-11-04) garde la valeur JDR en base et dans l'API.
 * - mode = mode effectif lu par toute l'app (GlobalNavBar, SpaceToolbar, ItemEditModal…)
 * Écrivains :
 * - applyContextMode : Layout.tsx UNIQUEMENT, au changement de communauté (id ou contexte) —
 *   réaligne mode sur le contexte et efface le choix manuel.
 * - chooseMode : boutons d'option du header (Layout.tsx) — surcharge valable tant qu'on reste
 *   dans la même communauté. Volontairement non persistée (pas de localStorage).
 * Documentation (wiki, procédures) et Exploration (veille, sources reliées) : modes ajoutés le 2026-11-13 (décision
 * Thomas) ; 'exploration' était réservé jusque-là.
 * Effet sur les vues d'espace (2026-11-13) : le mode ne choisit que les favoris en boutons directs
 * (lib/viewFavorites.ts, MODE_FAVORITE_VIEWS) ; toutes les vues restent dans « Toutes les vues ».
 * INTERFACE_MODE_LABELS : libellés des modes, lus par Layout (boutons de l'en-tête) et SpaceViewSelector.
 */
import { create } from 'zustand';

export type InterfaceMode = 'forum' | 'projet' | 'loisirs' | 'documentation' | 'exploration' | 'tous';

/** Libellés des modes (seule liste : en-tête et sélecteur de vues). */
export const INTERFACE_MODE_LABELS: Record<InterfaceMode, string> = {
  forum: 'Forum', projet: 'Projet', loisirs: 'Loisirs', documentation: 'Documentation', exploration: 'Exploration', tous: 'Tous',
};

/** Mode dérivé du contexte enregistré de la communauté (seul calcul : Layout, applyContextMode). */
export const CONTEXT_INTERFACE_MODE: Record<string, InterfaceMode> = {
  FORUM: 'forum', PROJECT: 'projet', JDR: 'loisirs', DOCUMENTATION: 'documentation', EXPLORATION: 'exploration',
};

export function modeForContext(context: string | null | undefined): InterfaceMode {
  return (context && CONTEXT_INTERFACE_MODE[context]) || 'tous';
}

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
  loisirs:     new Set(), // navigation globale complète (choix 2026-10-13), seules les vues d'espace changent
  documentation: new Set(['dashboard', 'tasks', 'activity', 'today']), // pas de pilotage personnel (2026-11-13)
  exploration: new Set(), // navigation complète : graphe et liens globaux y ont leur place (2026-11-13)
  tous:        new Set(),
};

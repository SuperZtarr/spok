/*
 * Style des boutons de séance (décision Thomas 2026-10-28) : orange plein, pour les distinguer des actions d'espace
 * (bleues). Utilisé par « Séances » (ParentSessionsButton) et les boutons du bandeau (LiveSessionBar : Préparation,
 * Fil, Présenter, Présentateurs, Invités, Démarrer la séance, Terminer, Créer la suite) et le bouton des séances en
 * direct de l'en-tête (LiveSessionsButton).
 * Les boutons qui ouvrent un panneau (Préparation, Fil, Présenter, Présentateurs, Invités) sont en orange clair
 * (LIVE_PANEL_*), les actions (Séances, Démarrer, Terminer, Créer la suite) en orange vif. *_ACTIVE : panneau ouvert.
 * Ne pas recopier ces classes ailleurs.
 */
export const LIVE_ACTION_CLASS =
  'inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-semibold bg-orange-500 text-white shadow-sm hover:bg-orange-600 transition-colors flex-shrink-0';
export const LIVE_ACTION_ACTIVE = 'ring-2 ring-orange-300 bg-orange-600';
/** Boutons qui ouvrent un panneau du bandeau (Préparation, Fil, Présenter, Présentateurs, Invités) : orange clair (2026-10-28). */
export const LIVE_PANEL_CLASS =
  'inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-semibold bg-orange-200 text-orange-900 hover:bg-orange-300 transition-colors flex-shrink-0';
export const LIVE_PANEL_ACTIVE = 'ring-2 ring-orange-400 bg-orange-300';

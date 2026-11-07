/*
 * Étapes de tour partagées par toutes les vues d'espace (modèle de tour convenu le 2026-10-14) :
 * gestes communs sur un élément (menu ⋮) puis barre commune, dans l'ordre de l'écran.
 * La barre commune est dérivée de ses éléments d'aide (help/spaceToolbar.elements.ts) : une commande ajoutée = son
 * élément là-bas, sans texte ici.
 * Usage dans une fiche : tour: [intro, ...étapes propres à la vue, ...ITEM_MENU_STEP, ...SPACE_TOOLBAR_STEPS].
 * Une étape dont l'élément est absent de l'écran est sautée (runTour, useOnboarding) : une vue sans
 * Ordre ou sans Nouveau ne montre simplement pas l'étape. La dernière étape « point d'interrogation » est
 * ajoutée automatiquement par runTour, sur le « ? » qui a lancé le tour (TOUR_ANCHOR_ATTR).
 */
import { elementTourSteps } from './elements';
import { SPACE_TOOLBAR_ELEMENTS } from './spaceToolbar.elements';
import type { TourStep } from './types';

/** Menu d'actions d'un élément (premier ⋮ affiché). */
export const ITEM_MENU_STEP: TourStep[] = [
  {
    element: '[data-tour="item-menu"]',
    popover: {
      title: 'Actions sur un élément',
      description: 'Le menu ⋮ regroupe toutes les actions : « Afficher » ouvre l\'élément en lecture (mise en page document, à copier ou imprimer), « Ouvrir » ouvre sa fiche (modifiable si vous en avez le droit), « Lire l\'article » ouvre un article sur sa page de lecture, comme un simple clic sur lui ; puis ajouter un enfant, déplacer ou dupliquer vers un autre espace, fusionner, changer le statut, m\'assigner, supprimer…',
      side: 'left',
    },
  },
];

/** Barre commune de l'espace, bouton Nouveau et Exporter. */
export const SPACE_TOOLBAR_STEPS: TourStep[] = elementTourSteps('toolbar', SPACE_TOOLBAR_ELEMENTS);

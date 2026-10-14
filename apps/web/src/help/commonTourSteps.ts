/*
 * Étapes de tour partagées par toutes les vues d'espace (modèle de tour convenu le 2026-10-14) :
 * gestes communs sur un élément (menu ⋮) puis barre commune, dans l'ordre de l'écran : Nouveau, Ordre, Filtre,
 * Aperçu, Séances, Insérer un modèle, Historique, Paramètres, puis Exporter (en-tête de la vue).
 * Une commande ajoutée à la barre d'espace = son étape ici (et son infobulle dans spaceToolbar.hints.ts).
 * Usage dans une fiche : tour: [intro, ...étapes propres à la vue, ...ITEM_MENU_STEP, ...SPACE_TOOLBAR_STEPS].
 * Une étape dont l'élément est absent de l'écran est sautée (runTour, useOnboarding) : une vue sans
 * Ordre ou sans Nouveau ne montre simplement pas l'étape. La dernière étape « point d'interrogation » est
 * ajoutée automatiquement par runTour, sur le « ? » qui a lancé le tour (TOUR_ANCHOR_ATTR).
 */
import type { TourStep } from './types';

/** Menu d'actions d'un élément (premier ⋮ affiché). */
export const ITEM_MENU_STEP: TourStep[] = [
  {
    element: '[data-tour="item-menu"]',
    popover: {
      title: 'Actions sur un élément',
      description: 'Le menu ⋮ regroupe toutes les actions : ajouter un enfant, déplacer ou dupliquer vers un autre espace, fusionner, changer le statut, m\'assigner, supprimer…',
      side: 'left',
    },
  },
];

/** Barre commune de l'espace et bouton Nouveau. */
export const SPACE_TOOLBAR_STEPS: TourStep[] = [
  {
    element: '[data-tour="new-item"]',
    popover: {
      title: 'Nouveau',
      description: 'Crée un élément dans cet espace ; sa fiche s\'ouvre pour le compléter.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-order"]',
    popover: {
      title: 'Ordre',
      description: 'Position = l\'ordre que vous avez organisé ; A→Z à plat trie tout par titre ; A→Z par groupe trie à l\'intérieur de chaque parent.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-filter"]',
    popover: {
      title: 'Filtre',
      description: 'Ne garde que certains types, statuts ou un texte recherché. Le bouton reste foncé tant qu\'un filtre est actif.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-highlight"]',
    popover: {
      title: 'Aperçu',
      description: 'Comme le filtre, mais sans rien masquer : les éléments qui ne correspondent pas sont simplement estompés.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-sessions"]',
    popover: {
      title: 'Séances',
      description: 'Présentez des éléments de l\'espace en direct à d\'autres membres : rejoignez la séance en cours ou, si vous êtes propriétaire de la communauté, préparez-en une.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-template"]',
    popover: {
      title: 'Insérer un modèle',
      description: 'Ajoute d\'un coup un ensemble d\'éléments enregistré comme modèle. Pour en créer un : dans la fiche d\'un élément, « Enregistrer comme modèle ».',
      side: 'bottom',
    },
  },
  {
    element: '[aria-label="Historique des modifications"]',
    popover: {
      title: 'Historique',
      description: 'Qui a modifié quoi et quand dans cet espace — et restauration d\'une version précédente.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-settings"]',
    popover: {
      title: 'Paramètres de l\'espace',
      description: 'Nom, visibilité, membres, vue par défaut… Réservé aux propriétaires de l\'espace.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="view-export"]',
    popover: {
      title: 'Exporter',
      description: 'Télécharge le contenu de la vue ; les formats proposés dépendent de la vue (CSV, Excel, PDF, image…).',
      side: 'bottom',
    },
  },
];

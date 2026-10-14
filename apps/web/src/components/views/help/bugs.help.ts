/* Aide utilisateur de la vue « Bugs » (bugs) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Bugs',
  summary: 'Les anomalies (éléments de type Bug) de l\'espace, en liste.',
  tips: [
    'Affiche uniquement les éléments de type Bug',
    'Mêmes gestes que la vue Liste : tri, clic, menu ⋮, glisser-déposer',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Bugs',
        description: 'La liste des anomalies à corriger dans cet espace.',
      },
    },
    {
      element: '[data-tour="list-headers"]',
      popover: {
        title: 'Colonnes triables',
        description: 'Cliquez sur un en-tête pour trier (par priorité, statut…) ; un second clic inverse l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="list-row"]',
      popover: {
        title: 'Un bug',
        description: 'Cliquez pour ouvrir sa fiche et décrire l\'anomalie ; changez son statut au fil de la correction.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « À faire » (todo) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'À faire',
  summary: 'Les tâches en cours de l\'espace (hors terminées et annulées), en liste.',
  tips: [
    'Affiche uniquement les tâches non terminées',
    'Mêmes gestes que la vue Liste : tri, clic, menu ⋮, glisser-déposer',
    'Une tâche terminée ou annulée sort de cette vue',
  ],
  tour: [
    {
      popover: {
        title: 'Vue À faire',
        description: 'Ce qui reste à faire dans cet espace : les tâches ni terminées ni annulées.',
      },
    },
    {
      element: '[data-tour="list-headers"]',
      popover: {
        title: 'Colonnes triables',
        description: 'Cliquez sur un en-tête pour trier ; un second clic inverse l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="list-row"]',
      popover: {
        title: 'Une tâche',
        description: 'Cliquez pour ouvrir sa fiche. Changez son statut pour la faire avancer : terminée, elle sort de la vue.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

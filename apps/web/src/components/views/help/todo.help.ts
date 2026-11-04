/* Aide utilisateur de la vue « À faire » (todo) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'À faire',
  summary: 'Tous les éléments ouverts de l\'espace, quel que soit leur type (hors terminés et annulés), en liste.',
  short: 'Éléments en cours',
  empty: 'Rien à faire. Les éléments terminés ou annulés n\'apparaissent pas ici ; créez-en un avec « Nouveau ».',
  tips: [
    'Affiche tous les types : tâches, notes, réunions, documents…',
    'Le filtre Types de la barre d\'espace restreint à un type',
    'Mêmes gestes que la vue Liste : tri, clic, menu ⋮, glisser-déposer',
    'Un élément terminé ou annulé sort de cette vue',
  ],
  zones: {
    contenu: { title: 'À faire', text: 'Les éléments de l\'espace, de tous types, qui ne sont ni terminés ni annulés, présentés en liste.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue À faire',
        description: 'Ce qui reste à faire dans cet espace : les éléments de tous types, ni terminés ni annulés.',
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
        title: 'Un élément',
        description: 'Cliquez pour ouvrir sa fiche. Changez son statut pour le faire avancer : terminé, il sort de la vue.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

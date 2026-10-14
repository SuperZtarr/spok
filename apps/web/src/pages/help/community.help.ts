/* Aide utilisateur de la page « Communauté » (/communities/:id).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Communauté',
  summary: 'La page d\'une communauté : ses espaces et ses membres.',
  tips: [
    'Cliquez sur un espace pour l\'ouvrir',
    '« Nouvel espace » en crée un dans la communauté',
    'La roue dentée ouvre les paramètres (propriétaire)',
  ],
  tour: [
    {
      popover: {
        title: 'La communauté',
        description: 'Ses espaces à gauche, ses membres à droite.',
      },
    },
    {
      element: '[data-tour="community-spaces"]',
      popover: {
        title: 'Espaces',
        description: 'Les espaces de la communauté ; cliquez pour en ouvrir un.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="community-new-space"]',
      popover: {
        title: 'Nouvel espace',
        description: 'Crée un espace dans cette communauté.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-members"]',
      popover: {
        title: 'Membres',
        description: 'Les membres et leur rôle.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="community-settings-link"]',
      popover: {
        title: 'Paramètres',
        description: 'Informations, contexte, référentiels, membres… (propriétaire).',
        side: 'left',
      },
    },
  ],
  fields: {
    newSpaceParent: 'Laissez vide pour un espace de premier niveau ; sinon il sera rangé sous l\'espace choisi.',
  },
};

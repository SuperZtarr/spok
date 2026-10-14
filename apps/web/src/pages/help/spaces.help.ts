/* Aide utilisateur de la page « Espaces » (/spaces).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Espaces',
  summary: 'Tous les espaces auxquels vous avez accès : espaces de groupe et espaces personnels.',
  tips: [
    'Cliquez sur une carte pour ouvrir l\'espace',
    'L\'icône de vue ouvre directement la vue par défaut de l\'espace',
    'La pastille indique la visibilité (héritée ou propre)',
  ],
  tour: [
    {
      popover: {
        title: 'Espaces',
        description: 'Tous vos espaces, en cartes.',
      },
    },
    {
      element: '[data-tour="spaces-group"]',
      popover: {
        title: 'Espaces de groupe',
        description: 'Les espaces partagés avec d\'autres, dans vos communautés.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="space-card"]',
      popover: {
        title: 'Une carte',
        description: 'Cliquez pour ouvrir l\'espace.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="space-card-open-view"]',
      popover: {
        title: 'Raccourcis',
        description: 'Ouvrir directement la vue par défaut ; la roue dentée mène aux paramètres (propriétaire).',
        side: 'left',
      },
    },
    {
      element: '[data-tour="spaces-personal"]',
      popover: {
        title: 'Espaces personnels',
        description: 'Vos espaces privés, hors communauté.',
        side: 'top',
      },
    },
  ],
};

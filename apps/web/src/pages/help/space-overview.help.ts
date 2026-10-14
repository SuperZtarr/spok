/* Aide utilisateur de la page « Aperçu de l'espace » (/spaces/:id/overview).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Aperçu de l\'espace',
  summary: 'La carte d\'identité d\'un espace : ses vues, ses sous-espaces, ses membres.',
  tips: [
    '« Ouvrir » entre dans l\'espace',
    'Cliquez sur une vue pour l\'ouvrir directement',
    'Cliquez sur un sous-espace pour y aller',
  ],
  tour: [
    {
      popover: {
        title: 'Aperçu de l\'espace',
        description: 'Avant d\'entrer : ce que contient l\'espace et qui y participe.',
      },
    },
    {
      element: '[data-tour="space-overview-open"]',
      popover: {
        title: 'Ouvrir',
        description: 'Entre dans l\'espace, sur sa vue par défaut.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="space-overview-views"]',
      popover: {
        title: 'Vues disponibles',
        description: 'Chaque carte ouvre l\'espace sur cette vue.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="space-overview-children"]',
      popover: {
        title: 'Sous-espaces',
        description: 'Les espaces rangés sous celui-ci.',
        side: 'top',
      },
    },
  ],
};

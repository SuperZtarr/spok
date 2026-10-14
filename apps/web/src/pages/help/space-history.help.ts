/* Aide utilisateur de la page « Historique » (/spaces/:id/history).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Historique',
  summary: 'Toutes les modifications de l\'espace — qui, quoi, quand — et la restauration d\'un état précédent.',
  tips: [
    'Filtrez par action, type d\'objet ou période',
    'Cliquez sur une entrée pour voir l\'avant / après',
    '« Restaurer » rétablit l\'état d\'avant la modification',
  ],
  tour: [
    {
      popover: {
        title: 'Historique',
        description: 'Le journal des modifications de l\'espace.',
      },
    },
    {
      element: '[data-tour="history-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Par action (création, modification, suppression, déplacement, relations), type d\'objet et période.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="history-entry"]',
      popover: {
        title: 'Une entrée',
        description: 'Qui a fait quoi et quand. Cliquez pour le détail avant / après.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="history-restore"]',
      popover: {
        title: 'Restaurer',
        description: 'Rétablit l\'état d\'avant cette modification (une confirmation est demandée).',
        side: 'left',
      },
    },
  ],
};

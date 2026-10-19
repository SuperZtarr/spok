/* Aide utilisateur de la page « Activité récente » (/activity).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Activité récente',
  summary: 'Les éléments modifiés par d\'autres que vous n\'avez pas encore vus, rangés par communauté et par espace.',
  tips: [
    'Un élément disparaît de la liste quand vous l\'ouvrez',
    '« Masquer l\'activité » retire une communauté de cette liste ; les notifications de la cloche restent actives',
    '« Marquer comme non lu » (menu d\'un élément) le fait revenir ici',
  ],
  tour: [
    {
      popover: {
        title: 'Activité récente',
        description: 'Ce qui a bougé chez les autres depuis votre dernier passage.',
      },
    },
    {
      element: '[data-tour="activity-community"]',
      popover: {
        title: 'Par communauté',
        description: 'Chaque bloc est une communauté. Son bouton « Masquer l\'activité » la retire d\'ici (la cloche n\'est pas concernée).',
        side: 'right',
      },
    },
    {
      element: '[data-tour="activity-space"]',
      popover: {
        title: 'Par espace',
        description: 'Dans chaque communauté, les espaces concernés.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="activity-items"]',
      popover: {
        title: 'Les éléments',
        description: 'Cliquez pour ouvrir l\'élément : une fois vu, il quitte la liste.',
        side: 'bottom',
      },
    },
  ],
};

/* Aide utilisateur de la page « Sunburst global » (/sunburst).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Sunburst global',
  summary: 'Toute votre arborescence en anneaux : communautés, puis espaces, puis éléments.',
  tips: [
    'Survolez un segment pour voir son chemin',
    'Cliquez une communauté ou un espace pour y aller',
    'Choisissez les communautés affichées dans le panneau',
  ],
  tour: [
    {
      popover: {
        title: 'Sunburst global',
        description: 'Du centre vers l\'extérieur : vos communautés, leurs espaces, leurs éléments.',
      },
    },
    {
      element: '[data-tour="sunburst-segment"]',
      popover: {
        title: 'Un segment',
        description: 'Survolez pour son chemin ; cliquez une communauté ou un espace pour y aller.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="sunburst-communities"]',
      popover: {
        title: 'Communautés',
        description: 'Cochez les communautés à afficher.',
        side: 'left',
      },
    },
  ],
};

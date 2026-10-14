/* Aide utilisateur de la page « Carte mentale globale » (/mindmap).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Carte mentale globale',
  summary: 'Toutes vos communautés et leurs espaces en carte, pour voir et réorganiser l\'arborescence.',
  tips: [
    'Cliquez sur un espace pour l\'ouvrir',
    'Glissez un espace sur un autre pour le ranger dessous (droits requis)',
    '« Réorganiser » replace tous les nœuds automatiquement',
  ],
  tour: [
    {
      popover: {
        title: 'Carte mentale globale',
        description: 'La structure de vos communautés et de leurs espaces.',
      },
    },
    {
      element: '[data-tour="global-mindmap-community"]',
      popover: {
        title: 'Une communauté',
        description: 'Le nœud d\'une communauté regroupe ses espaces.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="global-mindmap-space"]',
      popover: {
        title: 'Un espace',
        description: 'Cliquez pour l\'ouvrir. Glissez-le sur un autre espace pour le ranger dessous.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="global-mindmap-reset"]',
      popover: {
        title: 'Réorganiser',
        description: 'Replace tous les nœuds automatiquement.',
        side: 'left',
      },
    },
  ],
};

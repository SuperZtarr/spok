/* Aide utilisateur de la page « Carte mentale globale » (/mindmap).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Carte mentale globale',
  summary: 'Toutes vos communautés et leurs espaces en carte, pour voir et réorganiser l\'arborescence.',
  tips: [
    'Cliquez sur un espace ou une communauté pour ouvrir sa page',
    'Glissez un espace sur un autre pour le ranger dessous, sur une communauté pour l\'y rattacher à la racine',
    'Pendant le glisser, la cible pulse en vert et une étiquette dit ce qui va se passer ; en rouge, le dépôt est refusé (avec la raison)',
    'Il faut être propriétaire de l\'espace déplacé et pouvoir écrire dans la destination ; un refus s\'affiche en haut de la carte',
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
        description: 'Le nœud d\'une communauté regroupe ses espaces. Cliquez pour ouvrir sa page ; déposez-y un espace pour l\'y rattacher.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="global-mindmap-space"]',
      popover: {
        title: 'Un espace',
        description: 'Cliquez pour l\'ouvrir. Glissez-le sur un autre espace pour le ranger dessous : la cible pulse en vert, une étiquette annonce le déplacement.',
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

/* Aide utilisateur de la page « Carte mentale globale » (/mindmap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  communaute: {
    title: 'Une communauté',
    short: 'Cliquez pour ouvrir sa page.',
    text: 'Le nœud d\'une communauté regroupe ses espaces. Cliquez pour ouvrir sa page ; déposez-y un espace pour l\'y rattacher à la racine.',
    target: '[data-tour="global-mindmap-community"]',
    side: 'right',
  },
  espace: {
    title: 'Un espace',
    short: 'Cliquez pour l\'ouvrir, glissez pour le ranger.',
    text: 'Cliquez pour l\'ouvrir. Glissez-le sur un autre espace pour le ranger dessous : la cible pulse en vert et une étiquette annonce le déplacement ; en rouge, le dépôt est refusé, avec la raison. Il faut être propriétaire de l\'espace déplacé et pouvoir écrire dans la destination ; un refus s\'affiche en haut de la carte.',
    target: '[data-tour="global-mindmap-space"]',
    side: 'right',
  },
  reorganiser: {
    title: 'Réorganiser',
    short: 'Replace tous les nœuds automatiquement.',
    text: 'Replace tous les nœuds automatiquement.',
    target: '[data-tour="global-mindmap-reset"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Carte mentale globale',
  summary: 'Toutes vos communautés et leurs espaces en carte, pour voir et réorganiser l\'arborescence.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Carte mentale globale',
        description: 'La structure de vos communautés et de leurs espaces.',
      },
    },
    ...elementTourSteps('global-mindmap', elements),
  ],
};

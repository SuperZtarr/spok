/* Aide utilisateur de la page « Carte des espaces » (/mindmap, clé global-mindmap), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts.
   Titre lu dans MENU_REGISTRY (menuLabel), jamais recopié : renommée « Carte des espaces » le 2026-11-18 (ex-« Carte mentale », confondue avec la vue). */
import { menuLabel } from '@spok/shared';
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const TITLE = menuLabel('global-mindmap');

const elements: HelpElements = {
  communaute: {
    title: 'Une communauté',
    short: 'Cliquez pour ouvrir sa page.',
    text: 'Le nœud d\'une communauté regroupe ses espaces. Cliquez pour ouvrir sa page ; déposez-y un espace pour l\'y rattacher à la racine.',
    target: '[data-tour="global-mindmap-community"]',
    side: 'right',
    changes: [{ id: 'global-mindmap-renamed', kind: 'evolution', text: `Cette page s'appelle désormais « ${TITLE} » et se trouve dans la section « Tout SPOK » du bandeau, pour ne plus la confondre avec la vue Carte mentale d'un espace.`, date: '2026-11-18' }],
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
  title: TITLE,
  summary: 'Toutes vos communautés et leurs espaces en carte (sans les éléments), pour voir et réorganiser l\'arborescence.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: TITLE,
        description: 'La structure de vos communautés et de leurs espaces. Pour les éléments d\'un espace, utilisez sa vue Carte mentale.',
      },
    },
    ...elementTourSteps('global-mindmap', elements),
  ],
};

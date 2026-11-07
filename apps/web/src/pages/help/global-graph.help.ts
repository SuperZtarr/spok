/* Aide utilisateur de la page « Graphe global » (/graph), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton) et le tour. Elle affiche GraphView : le mode Aide y lit les zones graph:*. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  controles: {
    title: 'Liens et communautés',
    short: 'Types de liens et communautés affichés.',
    text: 'Choisissez les types de liens (hiérarchie, relations, tags) et les communautés affichées.',
    target: '[data-tour="graph-controls"]',
    noZone: true,
    side: 'left',
  },
  recentrer: {
    title: 'Recentrer',
    short: 'Refait tenir tout le graphe à l\'écran.',
    text: 'Refait tenir tout le graphe à l\'écran.',
    target: '[data-tour="graph-fit"]',
    noZone: true,
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Graphe global',
  summary: 'Tous les éléments de vos communautés en réseau : hiérarchie, relations et tags. Molette pour zoomer, glisser le fond pour se déplacer ; cliquez sur un nœud pour ouvrir l\'élément dans son espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Graphe global',
        description: 'Le réseau de tout ce que vous voyez, toutes communautés confondues. Cliquez sur un nœud : l\'élément s\'ouvre dans son espace.',
      },
    },
    ...elementTourSteps('global-graph', elements),
  ],
};

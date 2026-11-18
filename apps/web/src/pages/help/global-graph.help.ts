/* Aide utilisateur de la page « Réseau des éléments » (/graph, clé global-graph), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (PageHelpButton) et le tour. Elle affiche GraphView : le mode Aide y lit les zones graph:*. Registre help/pageHelp.ts.
   Titre lu dans MENU_REGISTRY (menuLabel), jamais recopié : renommée « Réseau des éléments » le 2026-11-18 (ex-« Graphe global »). */
import { menuLabel } from '@spok/shared';
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const TITLE = menuLabel('global-graph');

const elements: HelpElements = {
  controles: {
    title: 'Liens et communautés',
    short: 'Types de liens et communautés affichés.',
    text: 'Choisissez les types de liens (hiérarchie, relations, tags) et les communautés affichées.',
    target: '[data-tour="graph-controls"]',
    noZone: true,
    side: 'left',
    changes: [{ id: 'global-graph-renamed', kind: 'evolution', text: `Cette page s'appelle désormais « ${TITLE} » et se trouve dans la section « Tout SPOK » du bandeau, pour ne plus la confondre avec la vue Graphe d'un espace.`, date: '2026-11-18' }],
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
  title: TITLE,
  summary: 'Tous les éléments de vos communautés en réseau : hiérarchie, relations et tags. Molette pour zoomer, glisser le fond pour se déplacer ; cliquez sur un nœud pour ouvrir l\'élément dans son espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: TITLE,
        description: 'Le réseau de tout ce que vous voyez, toutes communautés confondues. Cliquez sur un nœud : l\'élément s\'ouvre dans son espace.',
      },
    },
    ...elementTourSteps('global-graph', elements),
  ],
};

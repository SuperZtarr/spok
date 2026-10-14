/* Aide utilisateur de la page « Graphe global » (/graph).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Graphe global',
  summary: 'Tous les éléments de vos communautés en réseau : hiérarchie, relations et tags.',
  tips: [
    'Molette pour zoomer, glisser le fond pour se déplacer',
    'Choisissez les communautés et les types de liens dans le panneau',
    'Cliquez sur un nœud pour ouvrir l\'élément dans son espace',
  ],
  tour: [
    {
      popover: {
        title: 'Graphe global',
        description: 'Le réseau de tout ce que vous voyez, toutes communautés confondues.',
      },
    },
    {
      element: '[data-tour="graph-controls"]',
      popover: {
        title: 'Liens et communautés',
        description: 'Choisissez les types de liens (hiérarchie, relations, tags) et les communautés affichées.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="graph-fit"]',
      popover: {
        title: 'Recentrer',
        description: 'Refait tenir tout le graphe à l\'écran.',
        side: 'right',
      },
    },
    {
      popover: {
        title: 'Ouvrir un élément',
        description: 'Cliquez sur un nœud : l\'élément s\'ouvre dans son espace.',
      },
    },
  ],
};

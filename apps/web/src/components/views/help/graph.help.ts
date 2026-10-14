/* Aide utilisateur de la vue « Graphe » (graph) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Graphe',
  summary: 'Le réseau des éléments : chaque élément est un point, reliés par leur hiérarchie, leurs relations et leurs tags.',
  tips: [
    'Molette pour zoomer, glisser le fond pour se déplacer',
    'Glissez un nœud pour l\'écarter des autres',
    'Cliquez sur un nœud pour ouvrir sa fiche',
    'Choisissez le périmètre et les types de liens dans le panneau',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Graphe',
        description: 'Vos éléments en réseau : les liens montrent qui dépend de qui, qui contient quoi, qui partage un tag.',
      },
    },
    {
      element: '[data-tour="graph-scope"]',
      popover: {
        title: 'Périmètre et liens',
        description: 'Espace seul, communauté ou tout ce que vous voyez ; affichez ou masquez la hiérarchie, les relations, les tags. En global, choisissez aussi les communautés.',
        side: 'right',
      },
    },
    {
      popover: {
        title: 'Naviguer',
        description: 'Molette pour zoomer, glisser le fond pour se déplacer, glisser un nœud pour l\'écarter. Survolez un nœud pour son nom, cliquez pour ouvrir sa fiche.',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Graphe » (graph), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  canevas: {
    title: 'Graphe',
    short: 'Les éléments et leurs liens en réseau.',
    text: 'Vos éléments en réseau : les liens montrent qui dépend de qui, qui contient quoi, qui partage un tag. Molette pour zoomer, glisser le fond pour se déplacer, glisser un nœud pour l\'écarter. Survolez un nœud pour son nom, cliquez pour ouvrir sa fiche.',
    side: 'top',
  },
  panneau: {
    title: 'Périmètre et liens',
    short: 'Choisissez le périmètre et les liens affichés.',
    text: 'Espace seul, communauté ou tout ce que vous voyez ; affichez ou masquez la hiérarchie, les relations, les tags. En global, choisissez aussi les communautés.',
    target: '[data-tour="graph-scope"]',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Graphe',
  summary: 'Le réseau des éléments : chaque élément est un point, reliés par leur hiérarchie, leurs relations et leurs tags.',
  short: 'Réseau de relations',
  empty: 'Aucun élément à relier. Le graphe se remplit dès que l\'espace contient des éléments : hiérarchie, relations et tags dessinent les liens.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('graph', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

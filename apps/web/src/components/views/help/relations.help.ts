/* Aide utilisateur de la vue « Relations » (relations), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  diagramme: {
    title: 'Carte des relations',
    short: 'Les éléments reliés et la nature de leurs liens.',
    text: 'Les dépendances et liens entre éléments, sans la hiérarchie : pour voir ce qui bloque quoi. Molette pour zoomer, glisser pour se déplacer, cliquez sur un élément pour ouvrir sa fiche.',
    side: 'top',
  },
  filtres: {
    title: 'Types de relations',
    short: 'Affichez chaque type de lien ou non.',
    text: 'Affichez chaque type de lien ou non, et les éléments isolés (sans relation) si besoin.',
    target: '[data-tour="relations-filters"]',
    side: 'right',
  },
  recentrer: {
    title: 'Recentrer',
    short: 'Refait tenir toute la carte à l\'écran.',
    text: 'Refait tenir toute la carte à l\'écran.',
    target: '[title="Recentrer"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Relations',
  summary: 'La carte des liens entre éléments (Bloque, Permet, Entraîne, Lié à), indépendamment de la hiérarchie.',
  short: 'Carte des relations',
  empty: 'Aucune relation entre éléments. Ajoutez-en depuis la fiche d\'un élément : Bloque, Permet, Entraîne ou Lié à.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('relations', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

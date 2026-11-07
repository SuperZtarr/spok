/* Aide utilisateur de la vue « Treemap » (treemap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  noeud: {
    title: 'Un rectangle',
    short: 'Cliquez pour zoomer, double-cliquez pour sa fiche.',
    text: 'Clic sur un rectangle qui en contient d\'autres : zoom dessus (« Zoom arrière » pour revenir). Double-clic : ouvre sa fiche.',
    target: '[data-tour="treemap-node"]',
    side: 'right',
  },
  mode: {
    title: 'Taille des rectangles',
    short: 'Choisissez ce que mesure la surface.',
    text: 'Par contributions, par nombre d\'enfants ou égale.',
    target: '[data-tour="treemap-mode"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Treemap',
  summary: 'La hiérarchie en rectangles imbriqués : la surface d\'un rectangle suit le critère choisi.',
  short: 'Rectangles proportionnels',
  empty: 'Aucun élément à découper en rectangles. Créez des éléments, puis des enfants sous eux, pour voir les rectangles s\'imbriquer.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Treemap',
        description: 'Les éléments en rectangles : un parent contient ses enfants, la surface montre leur poids.',
      },
    },
    ...elementTourSteps('treemap', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

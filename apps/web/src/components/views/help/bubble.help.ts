/* Aide utilisateur de la vue « Bulles » (bubble), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  noeud: {
    title: 'Une bulle',
    short: 'Cliquez pour zoomer ou ouvrir sa fiche.',
    text: 'Clic sur une bulle qui en contient d\'autres : zoom dessus (clic à nouveau ou sur le fond pour revenir). Clic sur une bulle simple ou double-clic : ouvre sa fiche.',
    target: '[data-tour="bubble-node"]',
    side: 'right',
  },
  taille: {
    title: 'Taille des bulles',
    short: 'Choisissez ce que mesure la taille.',
    text: 'Égale, proportionnelle aux contributions ou aux relations : pour repérer ce qui est le plus discuté ou le plus relié.',
    target: '[data-tour="bubble-size"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Bulles',
  summary: 'Les éléments en bulles imbriquées : un parent contient ses enfants, la taille suit le critère choisi.',
  short: 'Bulles proportionnelles',
  empty: 'Aucun élément à mettre en bulles. Créez des éléments, puis des enfants sous eux, pour voir les bulles s\'imbriquer.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Bulles',
        description: 'Chaque élément est une bulle ; ses enfants sont dedans.',
      },
    },
    ...elementTourSteps('bubble', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

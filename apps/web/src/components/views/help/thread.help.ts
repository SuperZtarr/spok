/* Aide utilisateur de la vue « Discussions » (thread), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  contenu: {
    title: 'Discussions',
    short: 'Les sujets de l\'espace, comme un forum.',
    text: 'Chaque élément est un sujet ; ses contributions sont les réponses. Les sujets sont triés par dernière activité : les plus actifs remontent en tête.',
    side: 'top',
  },
  sujet: {
    title: 'Un sujet',
    short: 'Cliquez pour le déplier.',
    text: 'Cliquez pour le déplier : sa description et ses contributions s\'affichent, et les sous-sujets sont décalés sous leur parent. « Ouvrir la fiche complète » ouvre l\'élément : vous y écrivez une contribution ou modifiez le sujet.',
    target: '[data-tour="thread-topic"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Discussions',
  summary: 'Les éléments de l\'espace présentés en sujets de forum, avec leurs contributions.',
  short: 'Sujets et contributions, façon forum',
  empty: 'Aucune discussion. Chaque élément devient un sujet ; ajoutez une contribution pour lancer l\'échange.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('thread', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

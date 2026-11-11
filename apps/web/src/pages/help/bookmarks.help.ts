/* Aide utilisateur de la page « Favoris & Épingles » (/bookmarks), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  favoris: {
    title: 'Espaces favoris',
    short: 'Les espaces marqués d\'une étoile.',
    text: 'Les espaces marqués d\'une étoile ; cliquez l\'étoile pour les ajouter ou les retirer.',
    target: '[data-tour="bookmarks-favorites"]',
    side: 'bottom',
  },
  recents: {
    title: 'Espaces récents',
    short: 'Les derniers espaces visités.',
    text: 'Les derniers espaces visités.',
    target: '[data-tour="bookmarks-recent"]',
    side: 'bottom',
  },
  epingles: {
    title: 'Éléments épinglés',
    short: 'Les éléments épinglés depuis leur menu.',
    text: 'Les éléments épinglés depuis leur menu, sur une ligne comme dans la Liste (miniature, titre, l\'essentiel, pastilles des contenus), avec le nom de leur espace ; le bouton corbeille les retire.',
    target: '[data-tour="bookmarks-pinned"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Favoris & Épingles',
  summary: 'Vos espaces favoris, vos espaces récents et les éléments que vous avez épinglés.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Favoris & Épingles',
        description: 'Vos raccourcis personnels vers ce que vous utilisez le plus.',
      },
    },
    ...elementTourSteps('bookmarks', elements),
  ],
};

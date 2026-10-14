/* Aide utilisateur de la page « Favoris & Épingles » (/bookmarks).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Favoris & Épingles',
  summary: 'Vos espaces favoris, vos espaces récents et les éléments que vous avez épinglés.',
  tips: [
    'L\'étoile d\'un espace l\'ajoute ou le retire des favoris',
    'Épinglez un élément depuis son menu pour le retrouver ici',
    'Le bouton corbeille retire un élément des épingles',
  ],
  tour: [
    {
      popover: {
        title: 'Favoris & Épingles',
        description: 'Vos raccourcis personnels vers ce que vous utilisez le plus.',
      },
    },
    {
      element: '[data-tour="bookmarks-favorites"]',
      popover: {
        title: 'Espaces favoris',
        description: 'Les espaces marqués d\'une étoile ; cliquez l\'étoile pour les retirer.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="bookmarks-recent"]',
      popover: {
        title: 'Espaces récents',
        description: 'Les derniers espaces visités.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="bookmarks-pinned"]',
      popover: {
        title: 'Éléments épinglés',
        description: 'Les éléments épinglés depuis leur menu ; la corbeille les retire.',
        side: 'top',
      },
    },
  ],
};

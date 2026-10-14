/* Aide utilisateur de la vue « Bulles » (bubble) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Bulles',
  summary: 'Visualisation en bulles dont la taille reflète le nombre d\'enfants ou de relations.',
  tips: [
    'La taille des bulles est proportionnelle au contenu',
    'Les couleurs représentent les types',
    'Cliquez sur une bulle pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Bulles',
        description: 'Cercles imbriqués : les parents contiennent leurs enfants. La taille reflète le volume (enfants, contributions ou égale).',
      },
    },
    {
      element: '[data-tour="bubble-size"]',
      popover: {
        title: 'Mode de taille',
        description: 'Choisissez comment dimensionner les bulles : taille égale, par nombre de contributions ou par nombre de relations.',
        side: 'left',
      },
    },
  ],
};

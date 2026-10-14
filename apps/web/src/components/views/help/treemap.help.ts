/* Aide utilisateur de la vue « Treemap » (treemap) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Treemap',
  summary: 'Diagramme en rectangles imbriqués montrant la hiérarchie et les proportions relatives.',
  tips: [
    'La surface de chaque rectangle reflète le poids relatif',
    'Les couleurs distinguent les types ou niveaux',
    'Cliquez sur un rectangle pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Treemap',
        description: 'Rectangles imbriqués : plus un item a d\'enfants ou de contributions, plus il est grand.',
      },
    },
    {
      element: '[data-tour="treemap-mode"]',
      popover: {
        title: 'Mode de taille',
        description: 'Choisissez comment dimensionner : par nombre d\'enfants, de contributions ou en taille égale.',
        side: 'bottom',
      },
    },
  ],
};

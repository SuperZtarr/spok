/* Aide utilisateur de la vue « Treemap » (treemap) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Treemap',
  summary: 'La hiérarchie en rectangles imbriqués : la surface d\'un rectangle suit le critère choisi.',
  tips: [
    'Cliquez sur un rectangle qui contient d\'autres rectangles pour zoomer dessus',
    'Double-cliquez sur un rectangle pour ouvrir sa fiche',
    'Choisissez la taille : par contributions, par enfants ou égale',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Treemap',
        description: 'Les éléments en rectangles : un parent contient ses enfants, la surface montre leur poids.',
      },
    },
    {
      element: '[data-tour="treemap-node"]',
      popover: {
        title: 'Un rectangle',
        description: 'Clic sur un rectangle qui en contient d\'autres : zoom dessus (« Zoom arrière » pour revenir). Double-clic : ouvre sa fiche.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="treemap-mode"]',
      popover: {
        title: 'Taille',
        description: 'Par contributions, par nombre d\'enfants ou égale.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

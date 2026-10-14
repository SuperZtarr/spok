/* Aide utilisateur de la vue « Sunburst » (sunburst) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Sunburst',
  summary: 'La hiérarchie en anneaux : le centre est l\'espace, chaque anneau un niveau, la taille d\'un segment son poids.',
  tips: [
    'Chaque anneau représente un niveau de profondeur',
    'La taille d\'un segment reflète son nombre de descendants',
    'Survolez un segment pour voir son chemin complet',
    'Cliquez sur un élément pour ouvrir sa fiche, sur un espace pour y aller',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Sunburst',
        description: 'La structure de l\'espace d\'un coup d\'œil : du centre vers l\'extérieur, chaque anneau descend d\'un niveau.',
      },
    },
    {
      element: '[data-tour="sunburst-segment"]',
      popover: {
        title: 'Un segment',
        description: 'Survolez-le pour voir son chemin (espace › parent › élément). Cliquez : un élément ouvre sa fiche, un espace ou une communauté vous y emmène.',
        side: 'right',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

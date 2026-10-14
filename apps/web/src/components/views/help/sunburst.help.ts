/* Aide utilisateur de la vue « Sunburst » (sunburst) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Sunburst',
  summary: 'Diagramme en cercles concentriques montrant la hiérarchie et les proportions.',
  tips: [
    'Chaque anneau représente un niveau de profondeur',
    'La taille des segments reflète le nombre d\'enfants',
    'Cliquez sur un segment pour l\'éditer',
    'Survolez pour voir les détails',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Sunburst',
        description: 'Cercles concentriques : le centre = espace, chaque anneau = un niveau de hiérarchie. Cliquez pour zoomer dans une branche.',
      },
    },
  ],
};

/* Aide utilisateur de la vue « Arbre radial » (radialTree) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Arbre radial',
  summary: 'Arbre hiérarchique disposé en cercle, compact et lisible pour les grandes structures.',
  tips: [
    'La racine est au centre, les feuilles sur les bords',
    'Zoomez pour explorer les branches',
    'Cliquez sur un nœud pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Arbre radial',
        description: 'Arborescence en cercle : la racine au centre, les branches rayonnent vers l\'extérieur. Survolez pour voir les détails.',
      },
    },
  ],
};

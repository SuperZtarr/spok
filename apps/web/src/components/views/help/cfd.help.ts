/* Aide utilisateur de la vue « Flux cumulatif » (cfd) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Flux cumulatif',
  summary: 'Diagramme de flux cumulatif (CFD) montrant l\'évolution des statuts dans le temps.',
  tips: [
    'Chaque bande colorée représente un statut',
    'L\'épaisseur d\'une bande montre le nombre d\'éléments dans ce statut',
    'Un rétrécissement indique un goulot d\'étranglement',
  ],
  tour: [
    {
      popover: {
        title: 'Flux cumulatif (CFD)',
        description: 'Empilage coloré des statuts dans le temps. La largeur de chaque bande = le nombre d\'items dans ce statut. Survolez pour le détail.',
      },
    },
  ],
};

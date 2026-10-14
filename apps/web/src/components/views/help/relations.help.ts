/* Aide utilisateur de la vue « Relations » (relations) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Relations',
  summary: 'Vue focalisée sur les liens entre éléments, montrant le réseau de relations.',
  tips: [
    'Les lignes représentent les relations entre éléments',
    'Zoomez et déplacez la vue pour explorer',
    'Cliquez sur un nœud pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Relations',
        description: 'Cartographie des liens entre items (bloque, dépend, lié) indépendamment de la hiérarchie parent-enfant.',
      },
    },
    {
      element: '[data-tour="relations-filters"]',
      popover: {
        title: 'Filtres de relations',
        description: 'Activez/désactivez chaque type de relation. Affichez les items isolés (sans relation) si besoin.',
        side: 'bottom',
      },
    },
  ],
};

/* Aide utilisateur de la vue « Réseau égocentrique » (ego) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Réseau égocentrique',
  summary: 'Graphe centré sur un item montrant ses voisins directs et indirects par anneaux concentriques.',
  tips: [
    'Sélectionnez l\'item central dans le menu déroulant ou cliquez sur un nœud',
    'Ajustez la profondeur (1 à 3 niveaux) avec le slider',
    'Cliquez sur un nœud pour recentrer le réseau sur cet item',
    'Double-cliquez pour éditer l\'item',
    'Les relations et la hiérarchie parent-enfant sont toutes deux affichées',
  ],
  tour: [
    {
      popover: {
        title: 'Réseau égocentrique',
        description: 'Explorez le réseau autour d\'un item. Voyez ses connexions directes et indirectes.',
      },
    },
    {
      element: '[data-tour="ego-controls"]',
      popover: {
        title: 'Contrôles',
        description: 'Choisissez l\'item central dans la liste. Ajustez la profondeur (1 à 3 niveaux) pour voir plus ou moins de connexions.',
        side: 'bottom',
      },
    },
  ],
};

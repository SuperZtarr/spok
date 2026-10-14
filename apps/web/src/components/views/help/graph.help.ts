/* Aide utilisateur de la vue « Graphe » (graph) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Graphe',
  summary: 'Réseau interactif montrant les éléments et toutes leurs relations (hiérarchie + liens).',
  tips: [
    'Zoomez avec la molette de la souris',
    'Glissez le fond pour déplacer la vue',
    'Glissez un nœud pour le repositionner',
    'Cliquez sur un nœud pour l\'éditer',
    'Les couleurs représentent les types d\'éléments',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Graphe',
        description: 'Réseau interactif de vos items. Les liens montrent la hiérarchie et les relations. Cliquez un nœud pour naviguer.',
      },
    },
    {
      element: '[data-tour="graph-scope"]',
      popover: {
        title: 'Portée & filtres',
        description: 'Choisissez : espace seul, communauté entière ou global. Activez/désactivez hiérarchie, relations et tags.',
        side: 'bottom',
      },
    },
  ],
};

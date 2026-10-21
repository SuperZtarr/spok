/* Aide utilisateur de la page d'administration « Statistiques » (/admin/stats, StatsPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Statistiques',
  summary: 'L\'activité de l\'instance : utilisateurs, espaces, communautés et éléments, avec leur évolution.',
  tips: [
    'Choisissez la période en haut à droite',
    'Les compteurs donnent les totaux ; les graphiques, l\'activité sur la période choisie',
  ],
  tour: [
    {
      popover: {
        title: 'Statistiques',
        description: 'Comment SPOK est utilisé.',
      },
    },
    {
      element: '[data-tour="admin-stats-period"]',
      popover: {
        title: 'Période',
        description: 'La période couverte par les tendances et les courbes.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="admin-stats-content"]',
      popover: {
        title: 'Indicateurs',
        description: 'Compteurs, tendances et courbes d\'activité.',
        side: 'top',
      },
    },
  ],
};

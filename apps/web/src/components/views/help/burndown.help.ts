/* Aide utilisateur de la vue « Burndown » (burndown) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Burndown',
  summary: 'Graphique montrant la progression des tâches terminées dans le temps.',
  tips: [
    'La ligne descend au fur et à mesure que les tâches sont terminées',
    'Comparez avec la ligne idéale pour évaluer le rythme',
    'Sélectionnez la période à afficher',
  ],
  tour: [
    {
      popover: {
        title: 'Burndown / Burnup',
        description: 'Suivez la progression dans le temps. Burnup = total + terminés. Burndown = reste à faire avec ligne idéale.',
      },
    },
    {
      element: '[data-tour="burndown-toggle"]',
      popover: {
        title: 'Mode',
        description: 'Basculez entre Burnup (2 courbes montantes) et Burndown (courbe descendante avec objectif en pointillés).',
        side: 'bottom',
      },
    },
  ],
};

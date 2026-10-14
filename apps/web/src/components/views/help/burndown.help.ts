/* Aide utilisateur de la vue « Burndown » (burndown) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Burndown',
  summary: 'L\'avancement des tâches dans le temps : ce qui reste à faire (burndown) ou ce qui est fait face au total (burnup).',
  short: 'Courbe d\'avancement',
  empty: 'Aucune tâche à suivre. La courbe se construit à partir des tâches de l\'espace et de leur avancement.',
  tips: [
    'Burndown : le reste à faire descend, comparé à une ligne idéale en pointillés',
    'Burnup : le total et les tâches terminées, deux courbes montantes',
    'Survolez la courbe pour le détail d\'une date',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Burndown',
        description: 'Êtes-vous dans les temps ? La courbe compare l\'avancement réel au rythme idéal.',
      },
    },
    {
      element: '[data-tour="burndown-toggle"]',
      popover: {
        title: 'Burnup ou Burndown',
        description: 'Burndown : reste à faire, à comparer à l\'objectif en pointillés. Burnup : total et terminés, l\'écart est ce qui reste.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="burndown-chart"]',
      popover: {
        title: 'Le graphique',
        description: 'Survolez pour le détail d\'une date. Une courbe au-dessus de l\'idéal signale un retard.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

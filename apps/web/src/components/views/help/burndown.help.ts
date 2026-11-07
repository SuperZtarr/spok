/* Aide utilisateur de la vue « Burndown » (burndown), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  bascule: {
    title: 'Burndown / Burnup',
    short: 'Reste à faire, ou total et terminés.',
    text: 'Burndown : le reste à faire descend, à comparer à l\'objectif en pointillés. Burnup : le total et les terminés, deux courbes montantes ; l\'écart est ce qui reste.',
    target: '[data-tour="burndown-toggle"]',
    side: 'bottom',
  },
  graphique: {
    title: 'Le graphique',
    short: 'Survolez pour le détail d\'une date.',
    text: 'L\'avancement jour après jour. Survolez pour le détail d\'une date ; une courbe au-dessus de l\'idéal signale un retard.',
    target: '[data-tour="burndown-chart"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Burndown',
  summary: 'L\'avancement des tâches dans le temps : ce qui reste à faire (burndown) ou ce qui est fait face au total (burnup).',
  short: 'Courbe d\'avancement',
  empty: 'Aucune tâche à suivre. La courbe se construit à partir des tâches de l\'espace et de leur avancement.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Burndown',
        description: 'Êtes-vous dans les temps ? La courbe compare l\'avancement réel au rythme idéal.',
      },
    },
    ...elementTourSteps('burndown', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

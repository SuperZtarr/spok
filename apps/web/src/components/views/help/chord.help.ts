/* Aide utilisateur de la vue « Cordes » (chord), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  mode: {
    title: 'Grouper et filtrer',
    short: 'Groupez par type ou par espace.',
    text: 'Groupez par type d\'élément ou par espace ; incluez ou non les liens parent-enfant.',
    target: '[data-tour="chord-mode"]',
    side: 'bottom',
  },
  diagramme: {
    title: 'Lire le diagramme',
    short: 'Un arc par groupe, un ruban par liaison.',
    text: 'Chaque arc est un groupe ; un ruban relie deux groupes, et plus il est large, plus il y a de relations. Survolez un arc ou un ruban pour le détail.',
    target: '[data-tour="chord-chart"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Cordes',
  summary: 'Les relations croisées entre groupes (types ou espaces), en arcs reliés par des rubans.',
  short: 'Relations croisées entre groupes',
  empty: 'Aucune relation à dessiner. Les rubans relient des éléments de types ou d\'espaces différents liés par une relation (Bloque, Permet…).',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Cordes',
        description: 'Quels groupes sont reliés entre eux, et à quel point.',
      },
    },
    ...elementTourSteps('chord', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

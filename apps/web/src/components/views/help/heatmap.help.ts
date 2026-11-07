/* Aide utilisateur de la vue « Activité (heatmap) » (heatmap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  reglages: {
    title: 'Période et mesure',
    short: 'La période et l\'activité comptée.',
    text: '6 mois ou 1 an ; compter les créations ou les modifications.',
    target: '[data-tour="heatmap-controls"]',
    side: 'bottom',
  },
  case: {
    title: 'Un jour',
    short: 'Survolez pour le détail du jour.',
    text: 'Plus la case est foncée, plus il s\'est passé de choses ce jour-là. Survolez pour voir le détail ; si un seul élément est concerné, un clic ouvre sa fiche.',
    target: '[data-tour="heatmap-cell"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Activité (heatmap)',
  summary: 'L\'activité jour par jour, façon GitHub : plus une case est foncée, plus il s\'est passé de choses ce jour-là.',
  short: 'Activité temporelle',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Activité',
        description: 'Le rythme de l\'espace : les jours de forte activité ressortent en foncé.',
      },
    },
    ...elementTourSteps('heatmap', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

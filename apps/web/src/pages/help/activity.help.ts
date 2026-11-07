/* Aide utilisateur de la page « Activité récente » (/activity), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  communaute: {
    title: 'Par communauté',
    short: 'Chaque bloc est une communauté.',
    text: 'Chaque bloc est une communauté. Son bouton « Masquer l\'activité » la retire d\'ici ; les notifications de la cloche restent actives.',
    target: '[data-tour="activity-community"]',
    side: 'right',
  },
  espace: {
    title: 'Par espace',
    short: 'Les espaces concernés.',
    text: 'Dans chaque communauté, les espaces concernés.',
    target: '[data-tour="activity-space"]',
    side: 'right',
  },
  elements: {
    title: 'Les éléments',
    short: 'Cliquez pour ouvrir l\'élément.',
    text: 'Cliquez pour ouvrir l\'élément : une fois vu, il quitte la liste. « Marquer comme non lu », dans son menu, le fait revenir ici.',
    target: '[data-tour="activity-items"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Activité récente',
  summary: 'Les éléments modifiés par d\'autres que vous n\'avez pas encore vus, rangés par communauté et par espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Activité récente',
        description: 'Ce qui a bougé chez les autres depuis votre dernier passage.',
      },
    },
    ...elementTourSteps('activity', elements),
  ],
};

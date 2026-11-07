/* Aide utilisateur de la vue « Flux cumulés » (cfd), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  legende: {
    title: 'Total et légende',
    short: 'Le total et la couleur de chaque statut.',
    text: 'Le nombre total d\'éléments et la couleur de chaque statut.',
    side: 'bottom',
  },
  graphique: {
    title: 'Lire les bandes',
    short: 'Une bande par statut.',
    text: 'Une bande par statut ; son épaisseur est le nombre d\'éléments dans ce statut à cette date. Survolez pour le détail. Une bande « En cours » qui s\'élargit signale du travail qui s\'accumule.',
    target: '[data-tour="cfd-chart"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Flux cumulés',
  summary: 'L\'évolution des statuts dans le temps : une bande colorée par statut, empilées.',
  short: 'Flux cumulatif',
  empty: 'Aucun élément dont suivre les statuts. Les bandes se construisent à partir de l\'historique des statuts des éléments.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Flux cumulés',
        description: 'Comment le travail circule : à faire, en cours, terminé… jour après jour.',
      },
    },
    ...elementTourSteps('cfd', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

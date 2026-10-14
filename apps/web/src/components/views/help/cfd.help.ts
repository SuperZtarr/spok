/* Aide utilisateur de la vue « Flux cumulés » (cfd) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Flux cumulés',
  summary: 'L\'évolution des statuts dans le temps : une bande colorée par statut, empilées.',
  short: 'Flux cumulatif',
  empty: 'Aucun élément dont suivre les statuts. Les bandes se construisent à partir de l\'historique des statuts des éléments.',
  tips: [
    'Chaque bande colorée représente un statut',
    'L\'épaisseur d\'une bande donne le nombre d\'éléments dans ce statut',
    'Une bande qui s\'élargit signale un goulot d\'étranglement',
  ],
  zones: {
    legende: { title: 'Total et légende', text: 'Le nombre total d\'éléments et la couleur de chaque statut.' },
    graphique: { title: 'Flux cumulés', text: 'Une bande par statut, son épaisseur est le nombre d\'éléments dans ce statut : une bande « En cours » qui s\'élargit signale du travail qui s\'accumule.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Flux cumulés',
        description: 'Comment le travail circule : à faire, en cours, terminé… jour après jour.',
      },
    },
    {
      element: '[data-tour="cfd-chart"]',
      popover: {
        title: 'Lire les bandes',
        description: 'Une bande par statut ; son épaisseur = le nombre d\'éléments dans ce statut à cette date. Survolez pour le détail. Une bande « En cours » qui s\'élargit = du travail qui s\'accumule.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

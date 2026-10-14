/* Aide utilisateur de la page « Mes tâches » (/tasks).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Mes tâches',
  summary: 'Toutes vos tâches, tous espaces confondus, rangées par horizon (maintenant, aujourd\'hui, cette semaine…).',
  tips: [
    'Les filtres choisissent la communauté, l\'espace, le statut, la priorité',
    'Cliquez sur un en-tête de colonne pour trier',
    'Cliquez sur une tâche pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Mes tâches',
        description: 'Vos tâches de tous les espaces au même endroit.',
      },
    },
    {
      element: '[data-tour="tasks-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Communauté (contexte de travail), espace, statut, priorité, recherche.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="tasks-headers"]',
      popover: {
        title: 'Colonnes',
        description: 'Cliquez sur un en-tête pour trier ; un second clic inverse l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="tasks-horizons"]',
      popover: {
        title: 'Par horizon',
        description: 'Maintenant, aujourd\'hui, cette semaine, ce mois, plus tard, à trier. Cliquez une tâche pour ouvrir sa fiche.',
        side: 'top',
      },
    },
  ],
};

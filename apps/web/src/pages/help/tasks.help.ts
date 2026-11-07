/* Aide utilisateur de la page « Mes tâches » (/tasks), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  filtres: {
    title: 'Filtres',
    short: 'Communauté, espace, statut, priorité, recherche.',
    text: 'Communauté (contexte de travail), espace, statut, priorité, recherche.',
    target: '[data-tour="tasks-filters"]',
    side: 'bottom',
  },
  colonnes: {
    title: 'Colonnes',
    short: 'Cliquez sur un en-tête pour trier.',
    text: 'Cliquez sur un en-tête pour trier ; un second clic inverse l\'ordre.',
    target: '[data-tour="tasks-headers"]',
    side: 'bottom',
  },
  horizons: {
    title: 'Par horizon',
    short: 'Vos tâches rangées par horizon.',
    text: 'Maintenant, aujourd\'hui, cette semaine, ce mois, plus tard, à trier. Cliquez une tâche pour ouvrir sa fiche.',
    target: '[data-tour="tasks-horizons"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Mes tâches',
  summary: 'Toutes vos tâches, tous espaces confondus, rangées par horizon (maintenant, aujourd\'hui, cette semaine…).',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Mes tâches',
        description: 'Vos tâches de tous les espaces au même endroit.',
      },
    },
    ...elementTourSteps('tasks', elements),
  ],
};

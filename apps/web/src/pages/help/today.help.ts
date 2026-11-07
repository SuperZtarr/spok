/* Aide utilisateur de la page « Ma journée » (/today), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  jour: {
    title: 'Changer de jour',
    short: 'Jour précédent, suivant, ou aujourd\'hui.',
    text: 'Jour précédent / suivant ; « Aujourd\'hui » pour revenir.',
    target: '[data-tour="today-nav"]',
    noZone: true,
    side: 'bottom',
  },
  calendriers: {
    title: 'Calendriers',
    short: 'Vos agendas externes.',
    text: 'L\'engrenage gère vos agendas externes (Outlook, Google… via leur lien ICS).',
    target: '[data-tour="today-feeds"]',
    noZone: true,
    side: 'left',
  },
  filtres: {
    title: 'Filtres',
    short: 'Restreignent les suggestions.',
    text: 'Restreignent les suggestions : communauté, espace, statut, priorité, recherche.',
    target: '[data-tour="today-filters"]',
    side: 'bottom',
  },
  agendas: {
    title: 'Colonnes d\'agenda',
    short: 'Affichez ou masquez chaque agenda.',
    text: 'Affichez ou masquez chaque agenda sur la grille. Glissez une tâche sur la grille pour la planifier à une heure.',
    target: '[data-tour="today-agendas"]',
    side: 'bottom',
  },
  revision: {
    title: 'À réviser',
    short: 'Les éléments à trier.',
    text: 'Les éléments à trier (ni échéance ni horizon) et ceux dont l\'horizon est dépassé.',
    target: '[data-tour="today-review"]',
    side: 'left',
  },
  plan: {
    title: 'Liste du jour',
    short: 'Ce que vous vous engagez à faire aujourd\'hui.',
    text: 'Ce que vous vous engagez à faire aujourd\'hui. Glissez une tâche sur la grille pour lui donner une heure, ou une réunion ici pour en faire une tâche.',
    target: '[data-tour="today-plan"]',
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Ma journée',
  summary: 'Votre journée sur une page : vos agendas, votre liste du jour, et les éléments à revoir.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Ma journée',
        description: 'Agenda, liste du jour et révision, réunis pour organiser la journée.',
      },
    },
    ...elementTourSteps('today', elements),
  ],
};

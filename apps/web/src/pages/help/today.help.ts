/* Aide utilisateur de la page « Ma journée » (/today).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Ma journée',
  summary: 'Votre journée sur une page : vos agendas, votre liste du jour, et les éléments à revoir.',
  tips: [
    'Glissez une tâche sur la grille pour la planifier à une heure',
    'Glissez une réunion dans la liste du jour pour en faire une tâche',
    'La section « À réviser » remonte ce qui n\'a ni échéance ni horizon, ou dont l\'horizon est dépassé',
    'L\'engrenage gère vos calendriers externes (abonnements ICS)',
  ],
  tour: [
    {
      popover: {
        title: 'Ma journée',
        description: 'Agenda, liste du jour et révision, réunis pour organiser la journée.',
      },
    },
    {
      element: '[data-tour="today-nav"]',
      popover: {
        title: 'Changer de jour',
        description: 'Jour précédent / suivant ; « Aujourd\'hui » pour revenir.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="today-feeds"]',
      popover: {
        title: 'Calendriers',
        description: 'Ajoutez vos agendas externes (Outlook, Google… via leur lien ICS).',
        side: 'left',
      },
    },
    {
      element: '[data-tour="today-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Restreignent les suggestions : communauté, espace, statut, priorité, recherche.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="today-agendas"]',
      popover: {
        title: 'Colonnes d\'agenda',
        description: 'Affichez ou masquez chaque agenda sur la grille.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="today-review"]',
      popover: {
        title: 'À réviser',
        description: 'Les éléments à trier (ni échéance ni horizon) et ceux dont l\'horizon est dépassé.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="today-plan"]',
      popover: {
        title: 'Liste du jour',
        description: 'Ce que vous vous engagez à faire aujourd\'hui. Glissez une tâche sur la grille pour lui donner une heure.',
        side: 'left',
      },
    },
  ],
};

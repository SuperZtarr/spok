/* Aide utilisateur du Tableau de bord (/dashboard).
   Lue par le point d'interrogation de l'écran (HelpButton) et le tour (usePageTourPulse) — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Tableau de bord',
  summary: 'Votre activité d\'un coup d\'œil : indicateurs, tâches prioritaires, semaine en cours et répartition par espace.',
  tips: [
    'Les filtres en haut s\'appliquent à tout le tableau de bord',
    'Cliquez sur une tâche pour ouvrir sa fiche',
    'Les répartitions montrent où se concentre le travail',
  ],
  tour: [
    {
      popover: {
        title: 'Tableau de bord',
        description: 'Vue d\'ensemble de votre activité : KPIs, tâches prioritaires, calendrier semaine et statistiques par espace.',
      },
    },
    {
      element: '[data-tour="dashboard-kpis"]',
      popover: {
        title: 'Indicateurs clés',
        description: 'En retard, aujourd\'hui, en cours, à valider, terminés cette semaine. Un coup d\'œil suffit pour connaître l\'état de vos tâches.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="org-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Filtrez par espace, communauté, type, statut ou priorité. Combinez les filtres pour cibler exactement ce que vous cherchez.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="org-priorities"]',
      popover: {
        title: 'Priorités & urgences',
        description: 'Trois colonnes : tâches prioritaires, en retard et du jour. Cliquez sur une tâche pour l\'ouvrir directement.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="org-week"]',
      popover: {
        title: 'Calendrier semaine',
        description: 'Visualisez vos tâches jour par jour. Naviguez entre les semaines avec les flèches. Les badges colorés indiquent le statut.',
        side: 'top',
      },
    },
  ],
};

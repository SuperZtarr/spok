/* Aide utilisateur du Tableau de bord (/dashboard), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (HelpButton), le tour (usePageTourPulse) et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  indicateurs: {
    title: 'Indicateurs clés',
    short: 'L\'état de vos tâches d\'un coup d\'œil.',
    text: 'En retard, aujourd\'hui, en cours, à valider, terminés cette semaine. Un coup d\'œil suffit pour connaître l\'état de vos tâches.',
    target: '[data-tour="dashboard-kpis"]',
    side: 'bottom',
  },
  filtres: {
    title: 'Filtres',
    short: 'Filtrent tout le tableau de bord.',
    text: 'Filtrez par espace, communauté, type, statut ou priorité : les filtres s\'appliquent à tout le tableau de bord et se combinent.',
    target: '[data-tour="org-filters"]',
    side: 'bottom',
  },
  priorites: {
    title: 'Priorités et urgences',
    short: 'Tâches prioritaires, en retard et du jour.',
    text: 'Trois colonnes : tâches prioritaires, en retard et du jour. Cliquez sur une tâche pour ouvrir sa fiche.',
    target: '[data-tour="org-priorities"]',
    side: 'bottom',
  },
  repartitions: {
    title: 'Répartitions',
    short: 'Où se concentre le travail.',
    text: 'Les répartitions montrent où se concentre le travail.',
    target: '[data-tour="org-distributions"]',
    side: 'top',
  },
  semaine: {
    title: 'Calendrier semaine',
    short: 'Vos tâches jour par jour.',
    text: 'Visualisez vos tâches jour par jour. Naviguez entre les semaines avec les flèches. Les badges colorés indiquent le statut.',
    target: '[data-tour="org-week"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Tableau de bord',
  summary: 'Votre activité d\'un coup d\'œil : indicateurs, tâches prioritaires, semaine en cours et répartition par espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Tableau de bord',
        description: 'Vue d\'ensemble de votre activité : KPIs, tâches prioritaires, calendrier semaine et statistiques par espace.',
      },
    },
    ...elementTourSteps('dashboard', elements),
  ],
};

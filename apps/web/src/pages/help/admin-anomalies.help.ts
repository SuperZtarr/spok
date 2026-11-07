/* Aide utilisateur de la page d'administration « Diagnostics » (/admin/anomalies, AnomaliesPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint) décrivant l'effet réel côté API : à revérifier à chaque évolution des
   routes /admin. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  onglets: {
    title: 'Onglets',
    short: 'Anomalies détectées, ou contrôles d\'intégrité.',
    text: 'Anomalies détectées, ou contrôles d\'intégrité : ces derniers sont en lecture seule, rien n\'est modifié.',
    target: '[data-tour="admin-anomalies-tabs"]',
    side: 'bottom',
  },
  contenu: {
    title: 'Le contenu',
    short: 'Les cartes d\'anomalies, ou le résultat des tests.',
    text: 'Une carte par type d\'incohérence, avec sa gravité et le nombre de cas, ou le résultat des tests. Cliquez une carte pour voir les cas ; les liens ouvrent l\'élément ou la liste filtrée.',
    target: '[data-tour="admin-anomalies-content"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Diagnostics',
  summary: 'La santé des données : incohérences détectées dans la base (orphelins, valeurs invalides…) et contrôles d\'intégrité.',
  ...derived,
  hints: {
    ...derived.hints,
    refresh: 'Relance la détection des anomalies (lecture seule).',
    runTests: 'Lance les contrôles d\'intégrité sur la base : lecture seule, rien n\'est modifié.',
  },
  tour: [
    {
      popover: {
        title: 'Diagnostics',
        description: 'Ce qui ne va pas dans les données, et où.',
      },
    },
    ...elementTourSteps('admin-anomalies', elements),
  ],
};

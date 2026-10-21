/* Aide utilisateur de la page d'administration « Diagnostics » (/admin/anomalies, AnomaliesPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Diagnostics',
  summary: 'La santé des données : incohérences détectées dans la base (orphelins, valeurs invalides…) et contrôles d\'intégrité.',
  tips: [
    'Onglet Anomalies : une carte par type d\'incohérence, avec sa gravité et le nombre de cas',
    'Cliquez une carte pour voir les cas ; les liens ouvrent l\'élément ou la liste filtrée',
    'Onglet Tests : des contrôles d\'intégrité en lecture seule — rien n\'est modifié',
  ],
  tour: [
    {
      popover: {
        title: 'Diagnostics',
        description: 'Ce qui ne va pas dans les données, et où.',
      },
    },
    {
      element: '[data-tour="admin-anomalies-tabs"]',
      popover: {
        title: 'Onglets',
        description: 'Anomalies détectées, ou contrôles d\'intégrité.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-anomalies-content"]',
      popover: {
        title: 'Le contenu',
        description: 'Les cartes d\'anomalies, ou le résultat des tests.',
        side: 'top',
      },
    },
  ],
  hints: {
    refresh: 'Relance la détection des anomalies (lecture seule).',
    runTests: 'Lance les contrôles d\'intégrité sur la base : lecture seule, rien n\'est modifié.',
  },
};

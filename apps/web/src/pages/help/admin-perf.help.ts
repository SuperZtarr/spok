/* Aide utilisateur de la page d'administration « Performances » (/admin/perf, PerfPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Performances',
  summary: 'Les requêtes récentes de l\'API : temps de réponse, taille, et les points d\'accès les plus lents.',
  tips: [
    'Les données viennent de la mémoire du serveur : elles repartent de zéro à chaque redémarrage',
    '« Endpoints les plus lents » classe les routes par temps moyen',
  ],
  tour: [
    {
      popover: {
        title: 'Performances',
        description: 'Où l\'API est lente ou lourde.',
      },
    },
    {
      element: '[data-tour="admin-perf-actions"]',
      popover: {
        title: 'Actions',
        description: 'Actualiser, ou vider le journal.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="admin-perf-slow"]',
      popover: {
        title: 'Les plus lents',
        description: 'Les routes classées par temps de réponse moyen.',
        side: 'top',
      },
    },
  ],
  hints: {
    refresh: 'Recharge les mesures.',
    clear: 'Vider : efface le journal des requêtes gardé en mémoire par le serveur. Il se remplit de nouveau au fil des requêtes ; rien d\'autre n\'est touché.',
  },
};

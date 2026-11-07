/* Aide utilisateur de la page d'administration « Performances » (/admin/perf, PerfPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint) décrivant l'effet réel côté API : à revérifier à chaque évolution des routes /admin.
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  actions: {
    title: 'Actions',
    short: 'Actualiser, ou vider le journal.',
    text: 'Actualiser, ou vider le journal. Les données viennent de la mémoire du serveur : elles repartent de zéro à chaque redémarrage.',
    target: '[data-tour="admin-perf-actions"]',
    side: 'left',
  },
  lents: {
    title: 'Les plus lents',
    short: 'Les routes classées par temps moyen.',
    text: 'Les routes classées par temps de réponse moyen.',
    target: '[data-tour="admin-perf-slow"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Performances',
  summary: 'Les requêtes récentes de l\'API : temps de réponse, taille, et les points d\'accès les plus lents.',
  ...derived,
  hints: {
    ...derived.hints,
    refresh: 'Recharge les mesures.',
    clear: 'Vider : efface le journal des requêtes gardé en mémoire par le serveur. Il se remplit de nouveau au fil des requêtes ; rien d\'autre n\'est touché.',
  },
  tour: [
    {
      popover: {
        title: 'Performances',
        description: 'Où l\'API est lente ou lourde.',
      },
    },
    ...elementTourSteps('admin-perf', elements),
  ],
};

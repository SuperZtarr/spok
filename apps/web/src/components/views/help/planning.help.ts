/* Aide utilisateur de la vue « Planning » (planning), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  contenu: {
    title: 'Sections par urgence',
    short: 'Les éléments rangés selon leur échéance.',
    text: 'Les éléments rangés selon leur échéance : En retard (rouge), Aujourd\'hui (bleu), Cette semaine, Ce mois, Plus tard, Sans date.',
    target: '[data-tour="planning-sections"]',
    side: 'top',
  },
  element: {
    title: 'Un élément',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Son échéance et son statut ; cliquez pour ouvrir sa fiche.',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Planning',
  summary: 'Les éléments datés regroupés par urgence : en retard, aujourd\'hui, cette semaine, ce mois, plus tard, sans date.',
  short: 'Échéances rangées par urgence',
  empty: 'Aucune tâche en cours à planifier. Les tâches non terminées apparaissent ici, rangées selon leur échéance.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Planning',
        description: 'Ce qui arrive, rangé par urgence — pour savoir quoi traiter en premier.',
      },
    },
    ...elementTourSteps('planning', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

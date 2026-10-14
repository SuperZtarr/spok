/* Aide utilisateur de la vue « Planning » (planning) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Planning',
  summary: 'Les éléments datés regroupés par urgence : en retard, aujourd\'hui, cette semaine, ce mois, plus tard, sans date.',
  tips: [
    'Les éléments sont rangés selon leur échéance',
    'En retard en rouge, aujourd\'hui en bleu',
    'Cliquez sur un élément pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Planning',
        description: 'Ce qui arrive, rangé par urgence — pour savoir quoi traiter en premier.',
      },
    },
    {
      element: '[data-tour="planning-sections"]',
      popover: {
        title: 'Sections par urgence',
        description: 'En retard (rouge), Aujourd\'hui (bleu), Cette semaine, Ce mois, Plus tard, Sans date. Cliquez un élément pour ouvrir sa fiche.',
        side: 'top',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

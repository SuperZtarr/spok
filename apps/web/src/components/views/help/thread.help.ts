/* Aide utilisateur de la vue « Discussions » (thread) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Discussions',
  summary: 'Les éléments de l\'espace présentés en sujets de forum, avec leurs contributions.',
  short: 'Sujets et contributions, façon forum',
  empty: 'Aucune discussion. Chaque élément devient un sujet ; ajoutez une contribution pour lancer l\'échange.',
  tips: [
    'Cliquez sur un sujet pour le déplier et lire ses contributions',
    'Les sujets sont triés par dernière activité',
    'Cliquez « Ouvrir la fiche complète » pour modifier le sujet ou y répondre',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Discussions',
        description: 'Chaque élément est un sujet ; ses contributions sont les réponses. Les sujets les plus actifs remontent en tête.',
      },
    },
    {
      element: '[data-tour="thread-topic"]',
      popover: {
        title: 'Un sujet',
        description: 'Cliquez pour le déplier : sa description et ses contributions s\'affichent. Les sous-sujets sont décalés sous leur parent.',
        side: 'bottom',
      },
    },
    {
      popover: {
        title: 'Répondre',
        description: 'Dans un sujet déplié, « Ouvrir la fiche complète » ouvre l\'élément : vous y écrivez une contribution ou modifiez le sujet.',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Cordes » (chord) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Cordes',
  summary: 'Les relations croisées entre groupes (types ou espaces), en arcs reliés par des rubans.',
  tips: [
    'Les arcs sont les groupes (types ou espaces), les rubans les relations entre eux',
    'Plus un ruban est large, plus il y a de relations',
    'Survolez un arc ou un ruban pour voir le détail',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Cordes',
        description: 'Quels groupes sont reliés entre eux, et à quel point.',
      },
    },
    {
      element: '[data-tour="chord-mode"]',
      popover: {
        title: 'Grouper et filtrer',
        description: 'Groupez par type d\'élément ou par espace ; incluez ou non les liens parent-enfant.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="chord-chart"]',
      popover: {
        title: 'Lire le diagramme',
        description: 'Chaque arc est un groupe ; un ruban relie deux groupes, sa largeur dit combien de relations. Survolez pour le détail.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

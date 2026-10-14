/* Aide utilisateur de la vue « Chord » (chord) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Chord',
  summary: 'Diagramme circulaire montrant les relations croisées entre types ou espaces.',
  tips: [
    'Les arcs représentent les groupes (types ou espaces)',
    'Les rubans montrent les relations entre groupes',
    'Survolez un arc ou un ruban pour voir les détails',
  ],
  tour: [
    {
      popover: {
        title: 'Diagramme Chord',
        description: 'Relations circulaires entre types ou espaces. Les rubans montrent l\'intensité des connexions.',
      },
    },
    {
      element: '[data-tour="chord-mode"]',
      popover: {
        title: 'Regroupement',
        description: 'Par type d\'item ou par espace. Incluez ou excluez les relations hiérarchiques (parent-enfant).',
        side: 'bottom',
      },
    },
  ],
};

/* Aide utilisateur de la vue « Heatmap » (heatmap) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Heatmap',
  summary: 'Carte de chaleur type GitHub montrant l\'activité quotidienne sur 6 mois ou 1 an.',
  tips: [
    'Chaque case représente un jour, la couleur indique l\'intensité',
    'Basculez entre créations et modifications',
    'Survolez une case pour voir les détails du jour',
    'Cliquez sur une case avec un seul élément pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Heatmap temporelle',
        description: 'Grille d\'activité : chaque case = un jour. Plus c\'est foncé, plus il y a eu de créations ou modifications.',
      },
    },
    {
      element: '[data-tour="heatmap-controls"]',
      popover: {
        title: 'Période & mode',
        description: '6 mois ou 1 an. Créations ou modifications. Survolez une case pour voir le détail du jour.',
        side: 'bottom',
      },
    },
  ],
};

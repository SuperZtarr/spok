/* Aide utilisateur de la vue « Tableau croisé » (crossTable) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Tableau croisé',
  summary: 'Tableau croisé dynamique montrant les éléments selon deux dimensions au choix.',
  tips: [
    'Sélectionnez les axes (lignes et colonnes) dans les menus',
    'Les cellules montrent le nombre d\'éléments correspondants',
    'Cliquez sur une cellule pour voir les éléments',
  ],
  tour: [
    {
      popover: {
        title: 'Tableau croisé',
        description: 'Croisez 2 dimensions pour compter vos items. Cliquez une cellule pour voir les items correspondants.',
      },
    },
    {
      element: '[data-tour="crosstable-dimensions"]',
      popover: {
        title: 'Axes',
        description: 'Choisissez les lignes et colonnes parmi : Type, Statut, Assigné, Espace. Le tableau se met à jour instantanément.',
        side: 'bottom',
      },
    },
  ],
};

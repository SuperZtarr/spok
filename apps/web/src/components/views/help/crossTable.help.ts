/* Aide utilisateur de la vue « Tableau croisé » (crossTable) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Tableau croisé',
  summary: 'Le nombre d\'éléments selon deux critères croisés : type, statut, assigné ou espace.',
  tips: [
    'Choisissez le critère des lignes et celui des colonnes',
    'Chaque cellule compte les éléments correspondants',
    'Cliquez sur une cellule pour voir ses éléments, puis sur un élément pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Tableau croisé',
        description: 'Croisez deux critères pour compter vos éléments — par exemple statut × assigné pour voir la charge de chacun.',
      },
    },
    {
      element: '[data-tour="crosstable-dimensions"]',
      popover: {
        title: 'Lignes et colonnes',
        description: 'Choisissez les deux critères : Type, Statut, Assigné ou Espace.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="crosstable-cell"]',
      popover: {
        title: 'Une cellule',
        description: 'Le nombre d\'éléments à ce croisement. Cliquez pour déplier leur liste, puis sur un élément pour ouvrir sa fiche.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

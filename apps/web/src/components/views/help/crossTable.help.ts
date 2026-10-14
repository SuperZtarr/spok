/* Aide utilisateur de la vue « Tableau croisé » (crossTable) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Tableau croisé',
  summary: 'Le nombre d\'éléments selon deux critères croisés : type, statut, assigné ou espace.',
  short: 'Tableau croisé dynamique',
  empty: 'Aucun élément à compter. Le tableau croise les éléments de l\'espace selon les deux critères choisis.',
  tips: [
    'Choisissez le critère des lignes et celui des colonnes',
    'Chaque cellule compte les éléments correspondants',
    'Cliquez sur une cellule pour voir ses éléments, puis sur un élément pour ouvrir sa fiche',
  ],
  zones: {
    dimensions: { title: 'Critères', text: 'Choisissez ce qui est en lignes et en colonnes : type, statut, assigné ou espace.' },
    case: { title: 'Un croisement', text: 'Le nombre d\'éléments à ce croisement ; cliquez pour déplier leur liste.' },
  },
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

/* Aide utilisateur de la vue « Tableau croisé » (crossTable), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  dimensions: {
    title: 'Lignes et colonnes',
    short: 'Choisissez les deux critères.',
    text: 'Choisissez ce qui est en lignes et en colonnes : Type, Statut, Assigné ou Espace.',
    target: '[data-tour="crosstable-dimensions"]',
    side: 'bottom',
  },
  case: {
    title: 'Une cellule',
    short: 'Cliquez pour déplier ses éléments.',
    text: 'Le nombre d\'éléments à ce croisement. Cliquez pour déplier leur liste, puis sur un élément pour ouvrir sa fiche.',
    target: '[data-tour="crosstable-cell"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Tableau croisé',
  summary: 'Le nombre d\'éléments selon deux critères croisés : type, statut, assigné ou espace.',
  short: 'Tableau croisé dynamique',
  empty: 'Aucun élément à compter. Le tableau croise les éléments de l\'espace selon les deux critères choisis.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Tableau croisé',
        description: 'Croisez deux critères pour compter vos éléments — par exemple statut × assigné pour voir la charge de chacun.',
      },
    },
    ...elementTourSteps('crossTable', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

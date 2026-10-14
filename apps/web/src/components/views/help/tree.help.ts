/* Aide utilisateur de la vue « Arborescence » (tree) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Arborescence',
  summary: 'Les éléments en arbre : chaque élément sous son parent, avec indentation.',
  short: 'Hiérarchie parent-enfant',
  empty: 'L\'espace ne contient encore aucun élément. Créez-en un avec « Nouveau », puis ajoutez-lui des enfants depuis son menu pour construire l\'arbre.',
  tips: [
    'Cliquez sur le chevron pour déplier ou replier une branche',
    'Glissez la poignée d\'un élément pour le déplacer ou le ranger sous un autre',
    'Cliquez sur un élément pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Arborescence',
        description: 'La hiérarchie de l\'espace : projets, sous-projets, tâches et sous-tâches, chacun sous son parent.',
      },
    },
    {
      element: '[data-tour="tree-expand"]',
      popover: {
        title: 'Déplier / Replier',
        description: 'Le chevron montre ou masque les enfants d\'un élément.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="tree-drag"]',
      popover: {
        title: 'Déplacer dans l\'arbre',
        description: 'Glissez la poignée : déposé entre deux lignes, l\'élément change de place ; déposé sur un élément, il passe dessous.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="collapse-toggle"]',
      popover: {
        title: 'Tout réduire / étendre',
        description: 'Replie ou déplie toutes les branches d\'un coup.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

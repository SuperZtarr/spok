/* Aide utilisateur de la vue « Kanban » (kanban) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Kanban',
  summary: 'Les éléments en colonnes par statut, pour suivre l\'avancement du travail.',
  short: 'Colonnes par statut',
  empty: 'Aucun élément à classer par statut. Créez-en un avec « Nouveau » : il se range dans la colonne de son statut.',
  tips: [
    'Glissez une carte d\'une colonne à l\'autre pour changer son statut',
    'Les colonnes sont les statuts de l\'espace (référentiels)',
    'Cliquez sur une carte pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Kanban',
        description: 'Vos éléments en colonnes par statut : on voit d\'un coup d\'œil ce qui est à faire, en cours, terminé.',
      },
    },
    {
      element: '[data-tour="kanban-column"]',
      popover: {
        title: 'Une colonne = un statut',
        description: 'Le compteur donne le nombre d\'éléments. Déposez une carte dans une colonne pour lui donner ce statut.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="kanban-card"]',
      popover: {
        title: 'Une carte = un élément',
        description: 'Cliquez pour ouvrir sa fiche. Elle montre le type, la priorité, l\'échéance et les tags. Glissez-la pour changer son statut.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

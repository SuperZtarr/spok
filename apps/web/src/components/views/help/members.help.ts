/* Aide utilisateur de la vue « Membres » (members) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Membres',
  summary: 'Les éléments en colonnes par personne assignée, plus « Non assigné ».',
  tips: [
    'Chaque colonne représente un membre de l\'espace',
    'Glissez une carte vers une colonne pour l\'assigner à ce membre',
    'La colonne « Non assigné » regroupe les éléments sans responsable',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Membres',
        description: 'Qui fait quoi : une colonne par membre de l\'espace.',
      },
    },
    {
      element: '[data-tour="members-column"]',
      popover: {
        title: 'Colonnes par membre',
        description: 'Déposez une carte dans la colonne d\'un membre pour la lui assigner. « Non assigné » regroupe les éléments libres.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

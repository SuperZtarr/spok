/* Aide utilisateur de la vue « Types » (types) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Types',
  summary: 'Les éléments en colonnes par type : notes, tâches, projets, réunions…',
  short: 'Colonnes par type d\'élément',
  empty: 'Aucun élément à classer par type. Créez des notes, tâches, projets… avec « Nouveau ».',
  tips: [
    'Chaque colonne correspond à un type d\'élément',
    'Glissez une carte vers une autre colonne pour changer son type',
    'Cliquez sur une carte pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Types',
        description: 'Vos éléments rangés par nature : notes, tâches, projets, réunions…',
      },
    },
    {
      element: '[data-tour="types-column"]',
      popover: {
        title: 'Une colonne = un type',
        description: 'Le compteur donne le nombre d\'éléments. Déposez une carte dans une autre colonne pour changer son type.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

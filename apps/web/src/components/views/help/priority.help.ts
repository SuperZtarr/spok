/* Aide utilisateur de la vue « Priorités » (priority) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Priorités',
  summary: 'Les éléments en colonnes par priorité, de P1 (Urgente) à P4 (Basse), plus « Sans priorité ».',
  short: 'Kanban par priorité',
  empty: 'Aucun élément à classer. Donnez une priorité (P1 à P4) aux éléments pour remplir les colonnes.',
  tips: [
    'Colonnes P1 (Urgente) à P4 (Basse) puis Sans priorité',
    'Glissez une carte vers une autre colonne pour changer sa priorité',
    'Cliquez sur une carte pour ouvrir sa fiche',
  ],
  zones: {
    colonne: { title: 'Colonne', text: 'Un niveau de priorité ; glisser une carte change sa priorité.' },
    carte: { title: 'Carte', text: 'Un élément ; cliquez pour ouvrir sa fiche.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Priorités',
        description: 'Pour reprioriser d\'un geste : chaque colonne est un niveau de priorité.',
      },
    },
    {
      element: '[data-tour="priority-column"]',
      popover: {
        title: 'Colonnes de priorité',
        description: 'De P1 (Urgente) à P4 (Basse), puis Sans priorité. Glissez une carte d\'une colonne à l\'autre pour changer sa priorité.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

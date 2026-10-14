/* Aide utilisateur de la vue « Liste » (list) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Liste',
  summary: 'Tous les éléments de l\'espace en tableau : titre, type, statut, priorité, dates, parent.',
  short: 'Tableau avec colonnes triables',
  empty: 'L\'espace ne contient encore aucun élément. Créez le premier avec « Nouveau ».',
  tips: [
    'Cliquez sur un en-tête de colonne pour trier, un second clic inverse l\'ordre',
    'Cliquez sur une ligne pour ouvrir la fiche de l\'élément',
    'Glissez-déposez une ligne pour la réordonner ou la ranger sous un autre élément',
    'Le menu ⋮ d\'une ligne regroupe toutes les actions',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Liste',
        description: 'Tous vos éléments en tableau. Triez, filtrez et agissez rapidement sur chaque ligne.',
      },
    },
    {
      element: '[data-tour="list-headers"]',
      popover: {
        title: 'Colonnes triables',
        description: 'Cliquez sur Titre, Type, Statut, Priorité ou Date pour trier. Un second clic inverse l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="list-row"]',
      popover: {
        title: 'Une ligne = un élément',
        description: 'Cliquez pour ouvrir sa fiche. Glissez-la pour la déplacer dans la liste ou la ranger sous un autre élément.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

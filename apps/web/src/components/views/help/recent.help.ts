/* Aide utilisateur de la vue « Modifications récentes » (recent) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Modifications récentes',
  summary: 'Les éléments ajoutés ou modifiés depuis votre dernière visite de l\'espace.',
  tips: [
    'Les nouveaux éléments sont listés en vert, les éléments modifiés en bleu',
    'Chaque liste fonctionne comme la vue Liste (clic, menu ⋮, tri)',
    'La date de visite est mise à jour à chaque ouverture : la vue repart de maintenant',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Récents',
        description: 'Ce qui a changé depuis votre dernier passage dans cet espace.',
      },
    },
    {
      element: '[data-tour="recent-new"]',
      popover: {
        title: 'Nouveaux',
        description: 'Les éléments créés depuis votre dernière visite.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="recent-modified"]',
      popover: {
        title: 'Modifiés',
        description: 'Les éléments modifiés depuis votre dernière visite. Ouvrez-en un pour voir ce qui a changé.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

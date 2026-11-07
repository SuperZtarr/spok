/* Aide utilisateur de la vue « Modifications récentes » (recent), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  nouveaux: {
    title: 'Nouveaux',
    short: 'Les éléments créés depuis votre dernière visite.',
    text: 'Les éléments créés depuis votre dernière visite, listés en vert. La liste fonctionne comme la vue Liste (clic, menu ⋮, tri).',
    target: '[data-tour="recent-new"]',
    side: 'bottom',
  },
  modifies: {
    title: 'Modifiés',
    short: 'Les éléments modifiés depuis votre dernière visite.',
    text: 'Les éléments modifiés depuis votre dernière visite, listés en bleu. Ouvrez-en un pour voir ce qui a changé. La liste fonctionne comme la vue Liste (clic, menu ⋮, tri).',
    target: '[data-tour="recent-modified"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Modifications récentes',
  summary: 'Les éléments ajoutés ou modifiés depuis votre dernière visite de l\'espace. La date de visite est mise à jour à chaque ouverture : la vue repart de maintenant.',
  short: 'Nouveautés depuis votre visite',
  empty: 'Rien de nouveau depuis votre dernière visite de l\'espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Récents',
        description: 'Ce qui a changé depuis votre dernier passage dans cet espace.',
      },
    },
    ...elementTourSteps('recent', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

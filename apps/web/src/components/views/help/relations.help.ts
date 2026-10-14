/* Aide utilisateur de la vue « Relations » (relations) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Relations',
  summary: 'La carte des liens entre éléments (Bloque, Permet, Entraîne, Lié à), indépendamment de la hiérarchie.',
  short: 'Carte des relations',
  empty: 'Aucune relation entre éléments. Ajoutez-en depuis la fiche d\'un élément : Bloque, Permet, Entraîne ou Lié à.',
  tips: [
    'Activez ou désactivez chaque type de relation',
    'Affichez ou non les éléments sans relation',
    'Molette pour zoomer, glisser pour se déplacer',
    'Cliquez sur un nœud pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Relations',
        description: 'Les dépendances et liens entre éléments, sans la hiérarchie : pour voir ce qui bloque quoi.',
      },
    },
    {
      element: '[data-tour="relations-filters"]',
      popover: {
        title: 'Types de relations',
        description: 'Affichez chaque type de lien ou non, et les éléments isolés (sans relation) si besoin.',
        side: 'right',
      },
    },
    {
      element: '[title="Recentrer"]',
      popover: {
        title: 'Recentrer',
        description: 'Refait tenir toute la carte à l\'écran.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

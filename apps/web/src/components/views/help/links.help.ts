/* Aide utilisateur de la vue « Liens » (links) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Liens',
  summary: 'Les éléments de type Lien de l\'espace, affichés en étiquettes avec l\'icône et le titre du site.',
  short: 'Liens avec favicon',
  empty: 'Aucun lien. Créez un élément de type Lien en collant son adresse.',
  tips: [
    'Cliquez sur un lien pour l\'ouvrir dans un nouvel onglet',
    'Double-cliquez pour ouvrir la fiche du lien',
    'L\'icône et le titre du site sont récupérés automatiquement',
  ],
  zones: {
    groupe: { title: 'Groupe', text: 'Les liens rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.' },
    tag: { title: 'Un lien', text: 'Cliquez pour ouvrir le site ; glissez-le vers un autre groupe pour changer son parent.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Liens',
        description: 'Tous les liens web de l\'espace en un coup d\'œil, regroupés sous leur élément parent.',
      },
    },
    {
      element: '[data-tour="links-tag"]',
      popover: {
        title: 'Un lien',
        description: 'Un clic ouvre le site dans un nouvel onglet ; un double-clic ouvre la fiche du lien. Survolez-le pour voir son adresse.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

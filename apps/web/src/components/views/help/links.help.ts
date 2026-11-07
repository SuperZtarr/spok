/* Aide utilisateur de la vue « Liens » (links), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  groupe: {
    title: 'Groupe',
    short: 'Les liens rangés sous un même parent.',
    text: 'Les liens rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.',
    side: 'bottom',
  },
  tag: {
    title: 'Un lien',
    short: 'Cliquez pour ouvrir le site.',
    text: 'Un clic ouvre le site dans un nouvel onglet ; un double-clic ouvre la fiche du lien. Glissez-le vers un autre groupe pour changer son parent. Son icône et son titre sont récupérés automatiquement ; survolez-le pour voir son adresse.',
    target: '[data-tour="links-tag"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Liens',
  summary: 'Les éléments de type Lien de l\'espace, affichés en étiquettes avec l\'icône et le titre du site.',
  short: 'Liens avec favicon',
  empty: 'Aucun lien. Créez un élément de type Lien en collant son adresse.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Liens',
        description: 'Tous les liens web de l\'espace en un coup d\'œil, regroupés sous leur élément parent.',
      },
    },
    ...elementTourSteps('links', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

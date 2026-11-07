/* Aide utilisateur de la vue « Texte » (text), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  recherche: {
    title: 'Recherche',
    short: 'Cherche dans le document.',
    text: 'Filtre le document sur les titres, descriptions et contributions.',
    target: '[placeholder^="Rechercher dans les titres"]',
    side: 'bottom',
  },
  element: {
    title: 'Un passage',
    short: 'Cliquez sur son titre pour ouvrir sa fiche.',
    text: 'Chaque passage est un élément de l\'espace ; cliquez sur son titre pour ouvrir sa fiche.',
    target: '[data-tour="text-item"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Texte',
  summary: 'Tout l\'espace en lecture continue, comme un document, dans l\'ordre de l\'arborescence : descriptions, contributions et pièces jointes. Il s\'exporte en PDF.',
  short: 'Document texte continu',
  empty: 'Rien à lire pour l\'instant : l\'espace n\'a pas encore d\'élément. Leurs descriptions et contributions s\'afficheront ici à la suite.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Texte',
        description: 'L\'espace mis en page comme un document, à lire de haut en bas.',
      },
    },
    ...elementTourSteps('text', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

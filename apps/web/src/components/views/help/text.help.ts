/* Aide utilisateur de la vue « Texte » (text) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Texte',
  summary: 'Tout l\'espace en lecture continue, comme un document : descriptions, contributions et pièces jointes.',
  short: 'Document texte continu',
  empty: 'Rien à lire pour l\'instant : l\'espace n\'a pas encore d\'élément. Leurs descriptions et contributions s\'afficheront ici à la suite.',
  tips: [
    'Lisez l\'espace comme un document, dans l\'ordre de l\'arborescence',
    'Recherchez dans les titres, descriptions et contributions',
    'Cliquez sur un titre pour ouvrir la fiche de l\'élément',
    'Exportez le document en PDF',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Texte',
        description: 'L\'espace mis en page comme un document, à lire de haut en bas.',
      },
    },
    {
      element: '[placeholder^="Rechercher dans les titres"]',
      popover: {
        title: 'Rechercher',
        description: 'Filtre le document sur les titres, descriptions et contributions.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="text-item"]',
      popover: {
        title: 'Un élément',
        description: 'Cliquez sur son titre pour ouvrir sa fiche.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

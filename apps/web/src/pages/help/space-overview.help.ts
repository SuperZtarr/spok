/* Aide utilisateur de la page « Aperçu de l'espace » (/spaces/:id/overview), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  ouvrir: {
    title: 'Ouvrir',
    short: 'Entre dans l\'espace.',
    text: 'Entre dans l\'espace, sur sa vue par défaut.',
    target: '[data-tour="space-overview-open"]',
    noZone: true,
    side: 'left',
  },
  vues: {
    title: 'Vues disponibles',
    short: 'Chaque carte ouvre une vue.',
    text: 'Chaque carte ouvre l\'espace sur cette vue.',
    target: '[data-tour="space-overview-views"]',
    side: 'bottom',
  },
  sousespaces: {
    title: 'Sous-espaces',
    short: 'Les espaces rangés sous celui-ci.',
    text: 'Les espaces rangés sous celui-ci ; cliquez sur un sous-espace pour y aller.',
    target: '[data-tour="space-overview-children"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Aperçu de l\'espace',
  summary: 'La carte d\'identité d\'un espace : ses vues, ses sous-espaces, ses membres.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Aperçu de l\'espace',
        description: 'Avant d\'entrer : ce que contient l\'espace et qui y participe.',
      },
    },
    ...elementTourSteps('space-overview', elements),
  ],
};

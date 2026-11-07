/* Aide utilisateur de la page « Liens » globale (/links), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  perimetre: {
    title: 'Périmètre',
    short: 'Vos espaces, une communauté ou un espace.',
    text: 'Tous vos espaces, une communauté, ou un espace et ses sous-espaces.',
    target: '[data-tour="global-links-scope"]',
    side: 'left',
  },
  recherche: {
    title: 'Rechercher',
    short: 'Filtre les liens chargés.',
    text: 'Filtre les liens chargés par titre, adresse, espace ou communauté.',
    target: '[data-tour="global-links-search"]',
    side: 'left',
  },
  communaute: {
    title: 'Par communauté',
    short: 'Rangés par communauté puis par espace.',
    text: 'Les liens sont rangés par communauté, puis par espace et sous-espace. Ils arrivent par paquets de 200 : « Charger plus » en bas de page, le total est affiché à côté du titre.',
    target: '[data-tour="global-links-community"]',
    side: 'top',
  },
  lien: {
    title: 'Un lien',
    short: 'Cliquez pour l\'ouvrir.',
    text: 'Cliquez pour l\'ouvrir dans un nouvel onglet ; survolez pour sa description.',
    target: '[data-tour="global-links-link"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Liens',
  summary: 'Tous les liens web de vos espaces, rangés par communauté puis par espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Liens',
        description: 'Tous les liens de vos espaces au même endroit.',
      },
    },
    ...elementTourSteps('global-links', elements),
  ],
};

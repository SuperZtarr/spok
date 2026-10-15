/* Aide utilisateur de la page « Liens » globale (/links).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Liens',
  summary: 'Tous les liens web de vos espaces, rangés par communauté puis par espace.',
  tips: [
    'Choisissez le périmètre : une communauté, ou un espace avec ses sous-espaces',
    'Recherchez par titre, adresse, espace ou communauté (parmi les liens chargés)',
    'Les liens arrivent par paquets de 200 : « Charger plus » en bas de page, le total est affiché à côté du titre',
    'Cliquez sur un lien pour l\'ouvrir dans un nouvel onglet',
  ],
  tour: [
    {
      popover: {
        title: 'Liens',
        description: 'Tous les liens de vos espaces au même endroit.',
      },
    },
    {
      element: '[data-tour="global-links-scope"]',
      popover: {
        title: 'Périmètre',
        description: 'Tous vos espaces, une communauté, ou un espace et ses sous-espaces.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="global-links-search"]',
      popover: {
        title: 'Rechercher',
        description: 'Filtre les liens chargés par titre, adresse, espace ou communauté.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="global-links-community"]',
      popover: {
        title: 'Par communauté',
        description: 'Les liens sont rangés par communauté, puis par espace et sous-espace.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="global-links-link"]',
      popover: {
        title: 'Un lien',
        description: 'Cliquez pour l\'ouvrir dans un nouvel onglet ; survolez pour sa description.',
        side: 'bottom',
      },
    },
  ],
};

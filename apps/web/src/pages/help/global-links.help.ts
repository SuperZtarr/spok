/* Aide utilisateur de la page « Tous les liens » (/links, clé global-links), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts.
   Titre lu dans MENU_REGISTRY (menuLabel), jamais recopié : renommée « Tous les liens » le 2026-11-18 (ex-« Liens », confondue avec la vue). */
import { menuLabel } from '@spok/shared';
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const TITLE = menuLabel('global-links');

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
    changes: [{ id: 'global-links-renamed', kind: 'evolution', text: `Cette page s'appelle désormais « ${TITLE} » et se trouve dans la section « Tout SPOK » du bandeau, pour ne plus la confondre avec la vue Liens d'un espace.`, date: '2026-11-18' }],
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
  title: TITLE,
  summary: 'Tous les liens web de vos espaces, rangés par communauté puis par espace.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: TITLE,
        description: 'Tous les liens de vos espaces au même endroit.',
      },
    },
    ...elementTourSteps('global-links', elements),
  ],
};

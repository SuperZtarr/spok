/* Aide utilisateur de la page « Panorama » (/sunburst, clé global-sunburst), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (PageHelpButton) et le tour. Elle affiche SunburstView : le mode Aide y lit les zones sunburst:*. Registre help/pageHelp.ts.
   Titre lu dans MENU_REGISTRY (menuLabel), jamais recopié : renommée « Panorama » le 2026-11-18 (ex-« Sunburst », confondue avec la vue). */
import { menuLabel } from '@spok/shared';
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const TITLE = menuLabel('global-sunburst');

const elements: HelpElements = {
  segment: {
    title: 'Un segment',
    short: 'Survolez pour son chemin.',
    text: 'Survolez pour son chemin ; cliquez une communauté ou un espace pour y aller.',
    target: '[data-tour="sunburst-segment"]',
    noZone: true,
    side: 'right',
    changes: [{ id: 'global-sunburst-renamed', kind: 'evolution', text: `Cette page s'appelle désormais « ${TITLE} » et se trouve dans la section « Tout SPOK » du bandeau, pour ne plus la confondre avec la vue Sunburst d'un espace.`, date: '2026-11-18' }],
  },
  communautes: {
    title: 'Communautés',
    short: 'Cochez les communautés à afficher.',
    text: 'Cochez les communautés à afficher.',
    target: '[data-tour="sunburst-communities"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: TITLE,
  summary: 'Toute votre arborescence en anneaux, toutes communautés confondues : communautés, puis espaces, puis éléments.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: TITLE,
        description: 'Du centre vers l\'extérieur : vos communautés, leurs espaces, leurs éléments.',
      },
    },
    ...elementTourSteps('global-sunburst', elements),
  ],
};

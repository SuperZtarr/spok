/* Aide utilisateur de la page « Sunburst global » (/sunburst), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton) et le tour. Elle affiche SunburstView : le mode Aide y lit les zones sunburst:*. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  segment: {
    title: 'Un segment',
    short: 'Survolez pour son chemin.',
    text: 'Survolez pour son chemin ; cliquez une communauté ou un espace pour y aller.',
    target: '[data-tour="sunburst-segment"]',
    noZone: true,
    side: 'right',
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
  title: 'Sunburst global',
  summary: 'Toute votre arborescence en anneaux : communautés, puis espaces, puis éléments.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Sunburst global',
        description: 'Du centre vers l\'extérieur : vos communautés, leurs espaces, leurs éléments.',
      },
    },
    ...elementTourSteps('global-sunburst', elements),
  ],
};

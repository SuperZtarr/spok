/* Aide utilisateur de la page d'administration « Référentiels » (/admin/referentiels, ReferentielsPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  statuts: {
    title: 'Statuts par défaut',
    short: 'Les statuts proposés par défaut.',
    text: 'Les statuts proposés quand une communauté n\'a rien personnalisé. Page en lecture seule : les référentiels se personnalisent dans les paramètres de chaque communauté (onglet Référentiels) ; les communautés personnalisées sont listées avec un lien vers leurs paramètres.',
    target: '[data-tour="admin-referentiels-statuses"]',
    side: 'top',
  },
  actualiser: {
    title: 'Actualiser',
    short: 'Recharge les référentiels.',
    text: 'Recharge les référentiels.',
    target: '[data-tour="admin-referentiels-refresh"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Référentiels',
  summary: 'Les statuts et types d\'éléments par défaut de SPOK, et les communautés qui les ont personnalisés.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Référentiels',
        description: 'Les listes de valeurs communes à tout SPOK.',
      },
    },
    ...elementTourSteps('admin-referentiels', elements),
  ],
};

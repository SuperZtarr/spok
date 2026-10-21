/* Aide utilisateur de la page d'administration « Référentiels » (/admin/referentiels, ReferentielsPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Référentiels',
  summary: 'Les statuts et types d\'éléments par défaut de SPOK, et les communautés qui les ont personnalisés.',
  tips: [
    'Page en lecture seule : les référentiels se personnalisent dans les paramètres de chaque communauté (onglet Référentiels)',
    'Les communautés personnalisées sont listées avec un lien vers leurs paramètres',
  ],
  tour: [
    {
      popover: {
        title: 'Référentiels',
        description: 'Les listes de valeurs communes à tout SPOK.',
      },
    },
    {
      element: '[data-tour="admin-referentiels-statuses"]',
      popover: {
        title: 'Statuts par défaut',
        description: 'Les statuts proposés quand une communauté n\'a rien personnalisé.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="admin-referentiels-refresh"]',
      popover: {
        title: 'Actualiser',
        description: 'Recharge les référentiels.',
        side: 'left',
      },
    },
  ],
};

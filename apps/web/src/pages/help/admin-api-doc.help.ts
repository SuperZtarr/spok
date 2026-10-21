/* Aide utilisateur de la page d'administration « Documentation API » (/admin/api-doc, ApiDocPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Documentation API',
  summary: 'La référence interne des points d\'accès de l\'API SPOK, de leur niveau d\'authentification et de leur logique d\'accès.',
  tips: [
    'Page statique en lecture seule : elle peut être en retard sur l\'API (date de mise à jour sous le titre)',
    'La légende donne le niveau d\'accès de chaque point : public, utilisateur, administrateur',
  ],
  tour: [
    {
      popover: {
        title: 'Documentation API',
        description: 'Comment l\'API est organisée et protégée.',
      },
    },
    {
      element: '[data-tour="admin-apidoc-legend"]',
      popover: {
        title: 'Légende',
        description: 'Le niveau d\'accès exigé, par couleur.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-apidoc-content"]',
      popover: {
        title: 'Les points d\'accès',
        description: 'Regroupés par domaine.',
        side: 'top',
      },
    },
  ],
};

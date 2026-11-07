/* Aide utilisateur de la page d'administration « Documentation API » (/admin/api-doc, ApiDocPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  legende: {
    title: 'Légende',
    short: 'Le niveau d\'accès exigé, par couleur.',
    text: 'Le niveau d\'accès de chaque point, par couleur : public, utilisateur, administrateur.',
    target: '[data-tour="admin-apidoc-legend"]',
    side: 'bottom',
  },
  points: {
    title: 'Les points d\'accès',
    short: 'Regroupés par domaine.',
    text: 'Regroupés par domaine. Page statique en lecture seule : elle peut être en retard sur l\'API (date de mise à jour sous le titre).',
    target: '[data-tour="admin-apidoc-content"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Documentation API',
  summary: 'La référence interne des points d\'accès de l\'API SPOK, de leur niveau d\'authentification et de leur logique d\'accès.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Documentation API',
        description: 'Comment l\'API est organisée et protégée.',
      },
    },
    ...elementTourSteps('admin-api-doc', elements),
  ],
};

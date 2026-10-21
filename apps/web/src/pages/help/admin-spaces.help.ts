/* Aide utilisateur de la page d'administration « Espaces » (/admin/spaces, SpacesPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Espaces (administration)',
  summary: 'Tous les espaces SPOK, personnels et de groupe, avec leur propriétaire, leur communauté et leur volume.',
  tips: [
    'Cliquez sur une ligne pour ouvrir les paramètres de l\'espace',
    'Les en-têtes de colonnes trient la liste',
    'Supprimer montre d\'abord l\'impact et laisse choisir le sort des sous-espaces',
  ],
  tour: [
    {
      popover: {
        title: 'Espaces',
        description: 'Tous les espaces, y compris ceux dont vous n\'êtes pas membre.',
      },
    },
    {
      element: '[data-tour="admin-spaces-csv"]',
      popover: {
        title: 'Export',
        description: 'Télécharge la liste au format CSV.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="admin-spaces-table"]',
      popover: {
        title: 'La liste',
        description: 'Cliquez une ligne pour ses paramètres ; la corbeille est à droite.',
        side: 'top',
      },
    },
  ],
  hints: {
    csv: 'Télécharge la liste au format CSV.',
    anomalyFilter: 'Filtre posé depuis Diagnostics : seuls les espaces concernés par cette anomalie sont listés.',
    delete: 'Supprimer : une confirmation montre l\'impact (sous-espaces, éléments, contributions) et laisse choisir — supprimer aussi les sous-espaces, ou les faire remonter d\'un niveau. Tout ou rien ; les suppressions restent restaurables depuis la page Audit.',
  },
};

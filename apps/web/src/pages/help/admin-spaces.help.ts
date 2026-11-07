/* Aide utilisateur de la page d'administration « Espaces » (/admin/spaces, SpacesPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint ; clé csv portée par son élément) décrivant l'effet réel côté API :
   à revérifier à chaque évolution des routes /admin. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  csv: {
    title: 'Export',
    short: 'Télécharge la liste au format CSV.',
    text: 'Télécharge la liste au format CSV.',
    target: '[data-tour="admin-spaces-csv"]',
    noZone: true,
    side: 'left',
  },
  liste: {
    title: 'La liste',
    short: 'Tous les espaces.',
    text: 'Cliquez une ligne pour ouvrir les paramètres de l\'espace ; les en-têtes de colonnes trient la liste. La corbeille est à droite : supprimer montre d\'abord l\'impact et laisse choisir le sort des sous-espaces.',
    target: '[data-tour="admin-spaces-table"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Espaces (administration)',
  summary: 'Tous les espaces SPOK, personnels et de groupe, avec leur propriétaire, leur communauté et leur volume.',
  ...derived,
  hints: {
    ...derived.hints,
    communityFilter: 'Ne lister que les espaces d\'une communauté, ou ceux qui ne sont rattachés à aucune (« Hors communauté »). Se combine avec la recherche et le type.',
    anomalyFilter: 'Filtre posé depuis Diagnostics : seuls les espaces concernés par cette anomalie sont listés.',
    delete: 'Supprimer : une confirmation montre l\'impact (sous-espaces, éléments, contributions) et laisse choisir — supprimer aussi les sous-espaces, ou les faire remonter d\'un niveau. Tout ou rien ; les suppressions restent restaurables depuis la page Audit.',
  },
  tour: [
    {
      popover: {
        title: 'Espaces',
        description: 'Tous les espaces, y compris ceux dont vous n\'êtes pas membre.',
      },
    },
    ...elementTourSteps('admin-spaces', elements),
  ],
};

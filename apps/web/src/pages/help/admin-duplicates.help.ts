/* Aide utilisateur de la page d'administration « Doublons » (/admin/duplicates, DuplicatesPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Doublons',
  summary: 'Les éléments en double dans tout SPOK : même titre, même adresse (liens) ou même nom de fichier.',
  tips: [
    'Un onglet par critère : titre, adresse, nom de fichier',
    'Les éléments d\'un même groupe sont côte à côte ; ouvrez-les pour comparer avant de supprimer',
    'La suppression demande une confirmation et reste restaurable depuis la page Audit',
  ],
  tour: [
    {
      popover: {
        title: 'Doublons',
        description: 'Les contenus saisis ou copiés plusieurs fois.',
      },
    },
    {
      element: '[data-tour="admin-duplicates-tabs"]',
      popover: {
        title: 'Critères',
        description: 'Titre identique, adresse identique ou nom de fichier identique.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-duplicates-refresh"]',
      popover: {
        title: 'Actualiser',
        description: 'Recalcule la liste des doublons.',
        side: 'left',
      },
    },
  ],
  hints: {
    refresh: 'Recalcule la liste des doublons (lecture seule).',
    open: 'Ouvre l\'élément dans son espace, dans un nouvel onglet.',
    delete: 'Supprimer cet élément (une confirmation suit) : même effet que depuis son espace — tracé et restaurable depuis la page Audit.',
  },
};

/* Aide utilisateur de la modale « Déplacer vers un autre espace » (MoveToSpaceModal).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels (pageHint) — registre help/pageHelp.ts.
   Rappels écrits d'après apps/api/src/routes/item-move.ts (bulk-move) et utils/processPlacement.ts : à revoir si
   la route change. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Déplacer vers un autre espace',
  summary: 'Envoie les éléments sélectionnés dans un autre espace : ils quittent celui-ci, avec leurs contributions et leur place dans le process.',
  tips: [
    'Choisissez l\'espace d\'arrivée : seuls les espaces où vous pouvez ajouter des éléments sont utiles (pas ceux où vous êtes lecteur)',
    'Aucun espace n\'est coché à l\'ouverture, même juste après un autre déplacement : le choix précédent n\'est pas repris',
    '« Inclure les éléments enfants » emmène toute la descendance ; sinon les enfants restent ici et remontent à la racine',
    'Un élément dont le parent ne part pas arrive à la racine de l\'espace d\'arrivée',
    'Les tags sont repris par nom dans l\'espace d\'arrivée (créés s\'ils n\'y existent pas)',
    'Les relations avec des éléments qui restent ici sont supprimées ; celles entre éléments déplacés sont gardées',
    'La place dans le process (positions, couloirs) suit les éléments ; un élément parti sans son couloir arrive libre',
  ],
  tour: [
    {
      popover: {
        title: 'Déplacer vers un autre espace',
        description: 'Les éléments quittent cet espace pour celui que vous choisissez.',
      },
    },
    {
      element: '[data-tour="move-targets"]',
      popover: {
        title: 'Espace d\'arrivée',
        description: 'Les espaces sont groupés par communauté ; la recherche filtre par nom d\'espace ou de communauté.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="move-children"]',
      popover: {
        title: 'Éléments enfants',
        description: 'Coché : toute la descendance part aussi. Décoché : les enfants restent ici, à la racine.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="move-confirm"]',
      popover: {
        title: 'Déplacer',
        description: 'Lance le déplacement : tags repris par nom, relations vers les éléments restés ici supprimées, place dans le process conservée.',
        side: 'top',
      },
    },
  ],
  hints: {
    includeChildren: 'Coché : enfants et petits-enfants partent avec leur parent. Décoché : ils restent dans cet espace et remontent à la racine.',
    confirm: 'Déplace les éléments dans l\'espace choisi : un élément sans son parent arrive à la racine, les tags sont repris par nom, les relations avec des éléments restés ici sont supprimées, la place dans le process (positions, couloirs) suit. Pas d\'annulation automatique (ni ici ni dans l\'historique) : pour revenir, redéplacez les éléments, les relations supprimées sont perdues.',
  },
};

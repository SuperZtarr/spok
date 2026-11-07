/* Aide utilisateur de la modale « Déplacer vers un autre espace » (MoveToSpaceModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour, le mode Aide et les rappels (pageHint : clés includeChildren et confirm, à ne pas renommer). Rappels écrits d'après
   apps/api/src/routes/item-move.ts (bulk-move) et utils/processPlacement.ts : à revoir si la route change. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  cibles: {
    title: 'Espace d\'arrivée',
    short: 'Choisissez l\'espace d\'arrivée.',
    text: 'Les espaces sont groupés par communauté ; la recherche filtre par nom d\'espace ou de communauté. Seuls les espaces où vous pouvez ajouter des éléments sont utiles (pas ceux où vous êtes lecteur). Aucun espace n\'est coché à l\'ouverture, même juste après un autre déplacement : le choix précédent n\'est pas repris.',
    target: '[data-tour="move-targets"]',
    side: 'top',
  },
  includeChildren: {
    title: 'Éléments enfants',
    short: 'Coché : enfants et petits-enfants partent avec leur parent. Décoché : ils restent dans cet espace et remontent à la racine.',
    text: 'Coché : toute la descendance part aussi. Décoché : les enfants restent ici, à la racine. Glisser un élément sur un espace de la barre latérale applique la même règle et emporte toujours ses enfants.',
    target: '[data-tour="move-children"]',
    noZone: true,
    side: 'top',
  },
  confirm: {
    title: 'Déplacer',
    short: 'Déplace les éléments dans l\'espace choisi : un élément sans son parent arrive à la racine, les tags sont repris par nom, les relations avec des éléments restés ici sont supprimées, la place dans le process (positions, couloirs) suit. Pas d\'annulation automatique (ni ici ni dans l\'historique) : pour revenir, redéplacez les éléments, les relations supprimées sont perdues.',
    text: 'Lance le déplacement. Un élément dont le parent ne part pas arrive à la racine de l\'espace d\'arrivée. Les tags sont repris par nom (créés s\'ils n\'y existent pas). Les relations avec des éléments qui restent ici sont supprimées ; celles entre éléments déplacés sont gardées. La place dans le process (positions, couloirs) suit les éléments ; un élément parti sans son couloir arrive libre.',
    target: '[data-tour="move-confirm"]',
    noZone: true,
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Déplacer vers un autre espace',
  summary: 'Envoie les éléments sélectionnés dans un autre espace : ils quittent celui-ci, avec leurs contributions et leur place dans le process.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Déplacer vers un autre espace',
        description: 'Les éléments quittent cet espace pour celui que vous choisissez.',
      },
    },
    ...elementTourSteps('move-to-space', elements),
  ],
};

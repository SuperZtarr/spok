/* Aide utilisateur de la modale « Dupliquer vers un espace » (DuplicateToSpaceModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour, le mode Aide et les rappels (pageHint : clés includeChildren, iterations et confirm, à ne pas renommer). Rappels écrits d'après
   apps/api/src/routes/item-bulk.ts (bulk-duplicate) : à revoir si la route change. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  cibles: {
    title: 'Espace d\'arrivée',
    short: 'Choisissez où créer les copies.',
    text: 'L\'espace actuel est coché à chaque ouverture : la copie se fait ici sauf si vous en choisissez un autre. Les espaces sont groupés par communauté ; la recherche filtre par nom d\'espace ou de communauté. Seuls les espaces où vous pouvez ajouter des éléments acceptent la copie (pas ceux où vous êtes lecteur).',
    target: '[data-tour="duplicate-targets"]',
    side: 'top',
  },
  includeChildren: {
    title: 'Éléments enfants',
    short: 'Coché : enfants et petits-enfants sont copiés sous la copie de leur parent. Décoché : seul l\'élément sélectionné est copié.',
    text: 'Coché : toute la descendance est copiée avec son parent. Décoché : seul l\'élément est copié.',
    target: '[data-tour="duplicate-children"]',
    noZone: true,
    side: 'top',
  },
  iterations: {
    title: 'Série de copies',
    short: 'Nombre de copies à créer (1 à 365). À partir de 2, les dates de chaque copie sont décalées : la 1re garde les dates d\'origine, la 2e avance d\'un cran, la 3e de deux…',
    text: '1 = une seule copie aux mêmes dates. Au-delà, choisissez le décalage (jour, semaine, mois ou an) : la 2e copie avance d\'un cran, la 3e de deux, etc.',
    target: '[data-tour="duplicate-iterations"]',
    noZone: true,
    side: 'top',
  },
  confirm: {
    title: 'Dupliquer',
    short: 'Crée les copies dans l\'espace choisi : titre, description, contenu, statut, priorité, dates (décalées en série) et tags repris par nom ; relations recopiées entre éléments copiés ensemble ; contributions non copiées. Dans le même espace, une copie sans son parent reste sous le parent d\'origine ; ailleurs, elle arrive à la racine. Pas d\'annulation automatique : supprimez les copies pour revenir en arrière.',
    text: 'Crée les copies dans l\'espace choisi ; chacune apparaît comme une création dans l\'historique. Sont copiés le titre, la description, le contenu, le lien, le statut, la priorité, les dates et les tags (repris par nom, créés s\'ils n\'existent pas), pas les contributions. Les relations entre éléments copiés ensemble sont recopiées ; celles vers les autres éléments ne le sont pas.',
    target: '[data-tour="duplicate-confirm"]',
    noZone: true,
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Dupliquer vers un espace',
  summary: 'Crée des copies des éléments sélectionnés, dans cet espace ou dans un autre ; les originaux ne bougent pas.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Dupliquer vers un espace',
        description: 'Crée des copies ; les éléments d\'origine restent tels quels.',
      },
    },
    ...elementTourSteps('duplicate-to-space', elements),
  ],
};

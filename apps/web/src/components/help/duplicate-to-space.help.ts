/* Aide utilisateur de la modale « Dupliquer vers un espace » (DuplicateToSpaceModal).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels (pageHint) — registre help/pageHelp.ts.
   Rappels écrits d'après apps/api/src/routes/item-bulk.ts (bulk-duplicate) : à revoir si la route change. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Dupliquer vers un espace',
  summary: 'Crée des copies des éléments sélectionnés, dans cet espace ou dans un autre ; les originaux ne bougent pas.',
  tips: [
    'L\'espace actuel est coché à chaque ouverture : la copie se fait ici sauf si vous choisissez un autre espace',
    'Seuls les espaces où vous pouvez ajouter des éléments acceptent la copie (pas ceux où vous êtes lecteur)',
    'Sont copiés : titre, description, contenu, lien, statut, priorité, dates et tags ; pas les contributions',
    'Les tags sont repris par nom dans l\'espace d\'arrivée (créés s\'ils n\'y existent pas)',
    'Les relations entre éléments copiés ensemble sont recopiées ; celles vers les autres éléments ne le sont pas',
    'Plusieurs itérations créent une série : chaque copie décale ses dates d\'un cran de plus (jour, semaine, mois ou an)',
  ],
  tour: [
    {
      popover: {
        title: 'Dupliquer vers un espace',
        description: 'Crée des copies ; les éléments d\'origine restent tels quels.',
      },
    },
    {
      element: '[data-tour="duplicate-targets"]',
      popover: {
        title: 'Espace d\'arrivée',
        description: 'L\'espace actuel est coché par défaut. Les espaces sont groupés par communauté ; la recherche filtre par nom d\'espace ou de communauté.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="duplicate-children"]',
      popover: {
        title: 'Éléments enfants',
        description: 'Coché : toute la descendance est copiée avec son parent. Décoché : seul l\'élément est copié.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="duplicate-iterations"]',
      popover: {
        title: 'Série de copies',
        description: '1 = une seule copie aux mêmes dates. Au-delà, choisissez le décalage : la 2e copie avance d\'un cran, la 3e de deux, etc.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="duplicate-confirm"]',
      popover: {
        title: 'Dupliquer',
        description: 'Crée les copies dans l\'espace choisi ; chacune apparaît comme une création dans l\'historique.',
        side: 'top',
      },
    },
  ],
  hints: {
    includeChildren: 'Coché : enfants et petits-enfants sont copiés sous la copie de leur parent. Décoché : seul l\'élément sélectionné est copié.',
    iterations: 'Nombre de copies à créer (1 à 365). À partir de 2, les dates de chaque copie sont décalées : la 1re garde les dates d\'origine, la 2e avance d\'un cran, la 3e de deux…',
    confirm: 'Crée les copies dans l\'espace choisi : titre, description, contenu, statut, priorité, dates (décalées en série) et tags repris par nom ; relations recopiées entre éléments copiés ensemble ; contributions non copiées. Dans le même espace, une copie sans son parent reste sous le parent d\'origine ; ailleurs, elle arrive à la racine. Pas d\'annulation automatique : supprimez les copies pour revenir en arrière.',
  },
};

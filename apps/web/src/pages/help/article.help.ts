/* Aide utilisateur de la page « Article » (/spaces/:spaceId/articles/:itemId) : lecture et mode Composer.
   Lue par le point d'interrogation (PageHelpButton), son tour et les rappels (pageHint) — registre help/pageHelp.ts.
   Rappels écrits d'après apps/api/src/routes/item-article.ts : à revoir si la route change. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Article',
  summary: 'Une page qui assemble, dans l\'ordre choisi, des éléments existants : notes, images, schémas, liens. Ils restent à leur place et peuvent servir dans plusieurs articles.',
  tips: [
    '« Composer » (si vous pouvez modifier l\'article) : ajouter, réordonner, régler ou retirer des blocs',
    'Ajout groupé : un élément avec ses enfants ou avec les éléments qui en découlent, ou tout un processus (ou un couloir), en une fois — 100 éléments au plus, tels qu\'ils sont au moment de l\'ajout',
    'Un bloc affiche un élément existant : le corriger le corrige partout où il apparaît',
    'Le texte d\'une note se modifie directement dans l\'article ; les autres blocs s\'ouvrent dans leur fiche',
    'Chaque bloc montre ce qui compte pour son type : le titre et le texte ; la légende sous une image ; l\'icône du site pour un lien ; la date d\'une réunion ; statut, échéance et priorité d\'une tâche ; les dates d\'un projet. Tags, assignation et contributions n\'y figurent pas',
    'Colonnes : « À côté » met un bloc à droite du précédent — jusqu\'à 3 colonnes de même largeur, empilées sur mobile',
    'Hiérarchie : un élément placé sous son parent (ou un ancêtre) dans l\'article est décalé vers la droite, avec un titre plus petit — 3 niveaux au plus',
    'Les lecteurs voient le contenu des blocs, sans accès aux éléments d\'origine',
    '« Imprimer » produit une version papier ou PDF propre',
  ],
  tour: [
    {
      popover: {
        title: 'Article',
        description: 'Des éléments existants mis bout à bout, dans une page de lecture continue.',
      },
    },
    {
      element: '[data-tour="article-header"]',
      popover: {
        title: 'Titre et chapeau',
        description: 'Le titre et la description de l\'article. Ils se modifient dans sa fiche.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="article-block"]',
      popover: {
        title: 'Un bloc',
        description: 'Un élément existant affiché dans l\'article. S\'il est barré « contenu indisponible », la personne qui l\'a ajouté n\'y a plus accès.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="article-compose"]',
      popover: {
        title: 'Composer',
        description: 'Passe en mode édition : ajouter des éléments ou du texte, glisser pour réordonner, régler la largeur et la position.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="article-insert"]',
      popover: {
        title: 'Insérer ici',
        description: 'En mode Composer : « Élément » ouvre le sélecteur (parcourir les espaces, cocher un ou plusieurs éléments, ou prendre un processus) ; « Texte » crée une note. Un ajout groupé est confirmé avec le nombre d\'éléments.',
        side: 'top',
      },
    },
  ],
  hints: {
    unavailable: 'Contenu indisponible : la personne qui a ajouté ce bloc n\'a plus accès à l\'élément d\'origine.',
    empty: 'Cet article est vide. Passez en mode « Composer » pour y ajouter des éléments ou du texte.',
    print: 'Ouvre l\'impression du navigateur (papier ou PDF), sans le cadre de l\'application.',
    compose: 'Passe en mode édition de l\'article.',
    read: 'Revient à la lecture de l\'article.',
    openSource: 'Ouvre la fiche de l\'élément d\'origine.',
    addItem: 'Ouvre le sélecteur : parcourez les espaces, cochez un ou plusieurs éléments existants (ou prenez un processus) et ajoutez-les à cet endroit. Les éléments restent à leur place ; ils peuvent figurer dans d\'autres articles.',
    addText: 'Crée une nouvelle note dans l\'espace de l\'article et l\'insère à cet endroit.',
    remove: 'Retire ce bloc de l\'article. L\'élément d\'origine n\'est pas supprimé.',
    beside: 'À côté : place ce bloc à droite du bloc précédent. Des blocs « à côté » qui se suivent forment une rangée de colonnes de même largeur (3 au plus) ; sur mobile, ils s\'empilent. Le glisser-déposer change qui est à côté de qui.',
    width: 'Largeur du bloc : pleine, large ou moyenne (sur mobile, tout est en pleine largeur).',
    align: 'Position de l\'image ou du schéma : centrée, ou à gauche / à droite avec le texte suivant autour.',
    lessVisible: 'Cet élément est moins visible que l\'article (espace privé ou autre communauté) : tous les lecteurs de l\'article verront son contenu. Ils n\'auront pas accès à l\'élément lui-même.',
    duplicate: 'Cet élément figure déjà dans l\'article.',
    pickerEmpty: 'Aucun élément trouvé. Seuls les éléments que vous pouvez lire sont proposés, hors articles.',
    pickerScope: 'Cette communauté : éléments des espaces de la communauté de l\'article. Partout : tous les espaces que vous pouvez lire.',
    noteReadOnly: 'Vous ne pouvez pas modifier cette note : ouvrez sa fiche pour la lire.',
    addProcess: 'Ajoute à cet endroit les éléments d\'un processus (vue Process d\'un espace), entier ou un seul couloir, dans l\'ordre de lecture : couloir par couloir, de gauche à droite, puis les éléments hors couloir.',
    pickChildren: 'Ajoute aussi toute la descendance de l\'élément, chaque enfant juste après son parent.',
    pickChain: 'Ajoute aussi les éléments qui en découlent : liens « Entraîne », « Bloque » et « Permet » partant de l\'élément, de proche en proche (« Lié à » n\'est pas suivi).',
    batchConfirm: 'Ajoute ces éléments à cet endroit, chacun comme un bloc séparé, tels qu\'ils sont aujourd\'hui : ce qui sera ajouté plus tard à la grappe ou au processus n\'apparaîtra pas tout seul. Chaque bloc peut ensuite être retiré ou déplacé.',
    batchSkipped: 'Sautés : éléments déjà présents dans l\'article, articles (un article ne contient pas d\'article) et éléments que vous ne pouvez pas lire.',
    batchTooMany: 'Plus de 100 éléments : ajoutez une partie plus petite (un couloir, ou sans les éléments qui en découlent).',
    batchEmpty: 'Rien à ajouter : tous ces éléments sont déjà dans l\'article ou ne peuvent pas y figurer.',
    batchLessVisible: 'Certains de ces éléments sont moins visibles que l\'article (espace privé ou autre communauté) : tous les lecteurs de l\'article verront leur contenu, sans accès aux éléments eux-mêmes.',
    browserSpaces: 'Espaces que vous pouvez lire, avec leur nombre d\'éléments (hors articles). Choisissez-en un pour parcourir ses éléments.',
    browserTypes: 'Ne montrer que ces types d\'éléments (liste à plat, avec le nom du parent).',
    browserSearch: 'Cherche dans l\'espace choisi (ou dans tous les espaces avec « Partout ») : titres qui commencent par votre texte, puis qui le contiennent, puis texte des éléments (extrait affiché). 2 caractères minimum.',
    browserTruncated: 'Seuls les 500 premiers éléments de cet espace sont affichés : cherchez pour trouver les autres.',
    browserPresent: 'Déjà dans l\'article : un élément n\'y figure qu\'une fois.',
    browserAdd: 'Ajoute les éléments cochés à cet endroit, dans l\'ordre de l\'arbre. Un seul élément sans option est ajouté directement ; sinon le nombre d\'éléments est confirmé avant l\'ajout.',
    browserEmptySpace: 'Aucun élément dans cet espace.',
  },
};

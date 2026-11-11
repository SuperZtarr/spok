/* Aide utilisateur de la page « Article » (/spaces/:spaceId/articles/:itemId), la lecture, et du mode Composer de la fiche, écrite en éléments
   d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide. Les rappels (`hints`, via
   pageHint) détaillent les actions du mode Composer ; écrits d'après apps/api/src/routes/item-article.ts : à revoir si la route change.
   La clé `compose` de l'élément est lue par pageHint : ne pas la renommer. Registre help/pageHelp.ts.
   Contenus multiples (lot 3a, 2026-11-08) : un bloc se rend selon les contenus de l'élément (texte de `bloc`, rappel
   `align`) ; annonce article-block-contents (sans date, datée à la MEP). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  entete: {
    title: 'Titre et chapeau',
    short: 'Le titre et la description de l\'article.',
    text: 'Le titre et la description de l\'article. Ils se modifient dans sa fiche ; le menu ⋮ garde l\'accès à celle-ci, et « Retour à l\'espace » ramène à la vue d\'origine. « Imprimer » produit une version papier ou PDF propre.',
    target: '[data-tour="article-header"]',
    side: 'bottom',
  },
  bloc: {
    title: 'Un bloc',
    short: 'Un élément existant affiché dans l\'article.',
    text: 'Un élément existant affiché dans l\'article : le corriger le corrige partout où il apparaît. Le texte d\'une note se modifie directement ici ; les autres blocs s\'ouvrent dans leur fiche. Chaque bloc montre ce que porte l\'élément : son titre et son texte, puis ses contenus dans l\'ordre images, fichiers, liens, schémas ; la date d\'une réunion ; statut, échéance et priorité d\'une tâche ; les dates d\'un projet. Un élément qui ne porte que des images s\'affiche en grand avec sa légende ; un élément qui ne porte que des liens, en cartes avec l\'icône du site. Tags, assignation et contributions n\'y figurent pas. Les lecteurs voient le contenu des blocs, sans accès aux éléments d\'origine. S\'il est barré « contenu indisponible », la personne qui l\'a ajouté n\'y a plus accès.',
    target: '[data-tour="article-block"]',
    side: 'top',
    changes: [{ id: 'article-block-contents', kind: 'evolution', text: 'Un bloc d\'article montre tous les contenus de l\'élément (images, fichiers, liens, schémas), quel que soit son type.', date: '2026-11-11' }],
  },
  compose: {
    title: 'Composer',
    short: 'Ouvre la fiche de l\'article en mode Composer, pour travailler ses blocs.',
    text: 'Si vous pouvez modifier l\'article, ouvre sa fiche en mode Composer : ajouter des éléments ou du texte, glisser pour réordonner, régler la largeur et la position, retirer un bloc. Ajout groupé : un élément avec ses enfants ou avec les éléments qui en découlent, ou tout un processus (ou un couloir), en une fois — 100 éléments au plus, tels qu\'ils sont au moment de l\'ajout. Colonnes : « À côté » met un bloc à droite du précédent — jusqu\'à 3 colonnes de même largeur, empilées sur mobile. Hiérarchie : un élément placé sous son parent (ou un ancêtre) est décalé vers la droite, avec un titre plus petit — 3 niveaux au plus.',
    target: '[data-tour="article-compose"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Article',
  summary: 'Une page qui assemble, dans l\'ordre choisi, des éléments existants : notes, images, schémas, liens. Ils restent à leur place et peuvent servir dans plusieurs articles. On y arrive d\'un clic sur l\'article dans une vue de l\'espace, par « Lire l\'article » dans le menu ⋮ ou par un lien partagé.',
  ...derived,
  hints: {
    ...derived.hints,
    unavailable: 'Contenu indisponible : la personne qui a ajouté ce bloc n\'a plus accès à l\'élément d\'origine.',
    empty: 'Cet article est vide. Passez en mode « Composer » pour y ajouter des éléments ou du texte.',
    print: 'Ouvre l\'impression du navigateur (papier ou PDF), sans le cadre de l\'application.',
    openSource: 'Ouvre la fiche de l\'élément d\'origine.',
    addItem: 'Ouvre le sélecteur : parcourez les espaces, cochez un ou plusieurs éléments existants (ou prenez un processus) et ajoutez-les à cet endroit. Les éléments restent à leur place ; ils peuvent figurer dans d\'autres articles.',
    addText: 'Crée une nouvelle note dans l\'espace de l\'article et l\'insère à cet endroit.',
    remove: 'Retire ce bloc de l\'article. L\'élément d\'origine n\'est pas supprimé.',
    beside: 'À côté : place ce bloc à droite du bloc précédent. Des blocs « à côté » qui se suivent forment une rangée de colonnes de même largeur (3 au plus) ; sur mobile, ils s\'empilent. Le glisser-déposer change qui est à côté de qui.',
    width: 'Largeur du bloc : pleine, large ou moyenne (sur mobile, tout est en pleine largeur).',
    align: 'Position du bloc d\'images (élément qui ne porte que des images ou des schémas) : centrée, ou à gauche / à droite avec le texte suivant autour.',
    lessVisible: 'Cet élément est moins visible que l\'article (espace privé ou autre communauté) : tous les lecteurs de l\'article verront son contenu. Ils n\'auront pas accès à l\'élément lui-même.',
    duplicate: 'Cet élément figure déjà dans l\'article.',
    pickerEmpty: 'Aucun élément trouvé. Seuls les éléments que vous pouvez lire sont proposés, hors articles.',
    pickerScope: 'Cette communauté : éléments des espaces de la communauté de l\'article. Partout : tous les espaces que vous pouvez lire.',
    noteReadOnly: 'Vous ne pouvez pas modifier ce texte : ouvrez sa fiche pour la lire.',
    addProcess: 'Ajoute à cet endroit les éléments d\'un processus (vue Process d\'un espace), entier ou un seul couloir, dans l\'ordre de lecture : couloir par couloir, de gauche à droite, puis les éléments hors couloir.',
    pickChildren: 'Ajoute aussi toute la descendance de l\'élément, chaque enfant juste après son parent.',
    pickChain: 'Ajoute aussi les éléments qui en découlent : liens « Entraîne », « Bloque » et « Permet » partant de l\'élément, de proche en proche (« Lié à » n\'est pas suivi).',
    batchConfirm: 'Ajoute ces éléments à cet endroit, chacun comme un bloc séparé, tels qu\'ils sont aujourd\'hui : ce qui sera ajouté plus tard à la grappe ou au processus n\'apparaîtra pas tout seul. Chaque bloc peut ensuite être retiré ou déplacé.',
    batchSkipped: 'Sautés : éléments déjà présents dans l\'article, articles (un article ne contient pas d\'article) et éléments que vous ne pouvez pas lire.',
    // Limite : 100 ajoutés (BATCH_MAX), 1 000 parcourus (BATCH_VISIT_MAX, routes/item-article.ts)
    batchTooMany:'Trop d\'éléments : 100 au plus sont ajoutés à la fois, et 1 000 sont parcourus au plus, ceux déjà présents compris. Ajoutez une partie plus petite (un couloir, ou sans les éléments qui en découlent).',
    batchForbidden: 'Vous n\'avez pas accès à cet espace ou à l\'un de ces éléments : rien n\'a été ajouté. Modifiez la sélection ou demandez l\'accès.',
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
  tour: [
    {
      popover: {
        title: 'Article',
        description: 'Des éléments existants mis bout à bout, dans une page de lecture continue.',
      },
    },
    ...elementTourSteps('article', elements),
  ],
};

/* Aide utilisateur de la page « Article » (/spaces/:spaceId/articles/:itemId) : lecture et composition à la souris
   (Lire | Composer, ArticleComposer — 2026-11-26, avant : mode Composer de la fiche), écrite en éléments d'aide
   (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide. Les rappels
   (`hints`, via pageHint) détaillent les gestes et actions de la composition ; écrits d'après
   apps/api/src/routes/item-article.ts : à revoir si la route change.
   La clé `compose` de l'élément est lue par pageHint : ne pas la renommer. Registre help/pageHelp.ts.
   Contenus multiples (lot 3a, 2026-11-08) : un bloc se rend selon les contenus de l'élément (texte de `bloc`) ; annonce
   article-block-contents. Images selon leur nombre (2026-11-18) : annonce article-block-images. Composition à la
   souris : annonce article-compose-direct (sans date, datée à la MEP). */
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
    text: 'Un élément existant affiché dans l\'article : le corriger le corrige partout où il apparaît. Le texte d\'une note se modifie directement ici ; les autres blocs s\'ouvrent dans leur fiche. Chaque bloc montre ce que porte l\'élément : son titre et son texte, puis ses contenus dans l\'ordre images, fichiers, liens, schémas ; la date d\'une réunion ; statut, échéance et priorité d\'une tâche ; les dates d\'un projet. Le texte garde toujours sa mise en page. Une image seule se place à côté du texte (au-dessus sur mobile), plusieurs images forment une galerie sous le texte ; un clic agrandit une image. Le titre de l\'élément est toujours en intertitre au-dessus de son contenu ; chaque image porte son nom en légende dessous. Un élément qui ne porte que des images avec un texte court montre ce texte sous l\'image ; un élément qui ne porte que des liens, des cartes avec l\'icône du site et le nom du lien. Tags, assignation et contributions n\'y figurent pas. Les lecteurs voient le contenu des blocs, sans accès aux éléments d\'origine. S\'il est barré « contenu indisponible », la personne qui l\'a ajouté n\'y a plus accès.',
    target: '[data-tour="article-block"]',
    side: 'top',
    changes: [
      { id: 'article-block-contents', kind: 'evolution', text: "Un bloc d'article montre tous les contenus de l'élément (images, fichiers, liens, schémas), quel que soit son type.", date: '2026-11-11' },
      { id: 'article-block-images', kind: 'evolution', text: "Dans un article, le texte d'un élément illustré garde sa mise en page : une image se place à côté, plusieurs forment une galerie, et un clic agrandit l'image.", date: '2026-11-18' },
    ],
  },
  compose: {
    title: 'Lire | Composer',
    short: "Passez de la lecture à la composition de l'article.",
    text: "Si vous pouvez modifier l'article, « Composer » le montre tel qu'il se lit, avec un panneau d'éléments à gauche : vous placez les blocs à la souris et voyez tout de suite le résultat. « Lire » revient à la lecture. On compose aussi depuis la fiche de l\'article (Composer), en plein écran par-dessus la vue.",
    target: '[data-tour="article-compose"]',
    noZone: true,
    side: 'bottom',
    changes: [
      { id: 'article-compose-direct', kind: 'evolution', text: "Un article se compose désormais sur sa page, à la souris : glissez un bloc entre deux autres ou sur le bord d'un bloc pour le mettre à côté, tirez son bord pour sa largeur. Plus de boutons de réglage.", date: '2026-11-26' },
    ],
  },
  panneau: {
    title: 'À ajouter',
    short: "Les éléments de l'espace pas encore dans l'article.",
    text: "En composition, le panneau liste les éléments de l'espace de l'article qui n'y sont pas encore, en arbre (chevrons pour replier) ; la recherche donne une liste à plat. Glissez une ligne sur l'article pour la placer, ou « + » pour l'ajouter à la fin. « Ajouter d'un autre espace » cherche dans vos autres espaces ; « Texte » crée un nouvel élément de texte à la fin ; « Sélection multiple… » ajoute à la fin plusieurs éléments cochés, avec leurs enfants ou ce qui en découle, ou tout un processus. Le panneau se replie pour laisser la place.",
    target: '[data-tour="article-tray"]',
    side: 'right',
  },
  composition: {
    title: 'Placer les blocs',
    short: 'Glissez les blocs, tirez leur bord pour la largeur.',
    text: "Glissez un bloc (ou une ligne du panneau) : sur le haut ou le bas d'un bloc, il prend sa propre ligne au-dessus ou au-dessous ; sur son bord gauche ou droit, il se met à côté — 3 blocs au plus par ligne, empilés sur mobile. Un trait bleu montre où il va tomber. Tirez le bord droit d'un bloc seul pour sa largeur (1/3, 1/2, 2/3, 3/4 ou pleine), ou le trait entre deux blocs côte à côte pour partager la place. Au survol d'un bloc : ouvrir sa fiche, ou le retirer (l'élément n'est pas supprimé). Le texte d'un élément que vous pouvez modifier s'écrit directement dans le bloc. Un élément placé sous son parent (ou un ancêtre) est décalé vers la droite, avec un titre plus petit.",
    target: '[data-tour="article-canvas"]',
    side: 'top',
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
    empty: 'Cet article est vide. Passez sur « Composer » pour y ajouter des éléments ou du texte.',
    composeEmpty: 'Glissez ici un élément du panneau « À ajouter », ou cliquez sur son « + ».',
    readMode: "Lire : l'article tel que le voient ses lecteurs.",
    back: "Retour : revient là d'où vous avez ouvert l'article (vue de l'espace, recherche…), sinon au contenu de l'espace.",
    editMode: "Modifier : ouvre la fiche de l'article (titre, chapeau, statut, dates) dans son espace.",
    print: 'Ouvre l\'impression du navigateur (papier ou PDF), sans le cadre de l\'application.',
    openSource: 'Ouvre la fiche de l\'élément d\'origine.',
    addText: "Crée un nouvel élément de texte dans l'espace de l'article et l'ajoute à la fin ; écrivez directement dans le bloc, puis glissez-le où vous voulez.",
    move: "Glissez le bloc : sur le haut ou le bas d'un autre bloc pour l'insérer sur sa propre ligne, sur son bord gauche ou droit pour le mettre à côté.",
    rowFull: 'Cette ligne a déjà 3 blocs : déposez plutôt au-dessus ou au-dessous.',
    remove: 'Retire ce bloc de l\'article. L\'élément d\'origine n\'est pas supprimé.',
    width: 'Tirez ce bord pour la largeur du bloc : 1/3, 1/2, 2/3, 3/4 ou pleine (sur mobile, tout est en pleine largeur).',
    share: 'Tirez ce trait pour partager la place entre les deux blocs côte à côte.',
    lessVisible: 'Cet élément est moins visible que l\'article (espace privé ou autre communauté) : tous les lecteurs de l\'article verront son contenu. Ils n\'auront pas accès à l\'élément lui-même.',
    duplicate: 'Cet élément figure déjà dans l\'article.',
    pickerEmpty: 'Aucun élément trouvé. Seuls les éléments que vous pouvez lire sont proposés, hors articles.',
    pickerScope: 'Cette communauté : éléments des espaces de la communauté de l\'article. Partout : tous les espaces que vous pouvez lire.',
    noteReadOnly: 'Vous ne pouvez pas modifier ce texte : ouvrez sa fiche pour la lire.',
    addProcess: 'Ajoute à cet endroit les éléments d\'un process (élément de type Process de cet espace), entier ou un seul couloir, dans l\'ordre de lecture : couloir par couloir, de gauche à droite, puis les éléments hors couloir. Les éléments que vous ne pouvez pas lire sont sautés.',
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
    // Panneau « À ajouter » de la composition (ElementTray, ArticleComposer — 2026-11-21)
    trayEmpty: 'Tous les éléments de l\'espace sont dans l\'article.',
    trayDrag: "glissez-le sur l'article pour le placer, ou « + » pour l'ajouter à la fin",
    trayAdd: "Ajoute cet élément à la fin de l'article. Pour le placer ailleurs, glissez la ligne sur l'article.",
    trayElsewhere: 'Ajouter d\'un autre espace : cherche un élément dans vos autres espaces et l\'ajoute à la fin de l\'article. L\'élément reste dans son espace.',
    trayElsewhereIntro: 'Choisissez un élément : il est ajouté à la fin de l\'article, d\'où vous le déplacez. Il reste dans son espace ; seuls les éléments que vous pouvez lire sont proposés.',
    trayMultiple: 'Ouvre le sélecteur à cocher : plusieurs éléments à la fois, avec leurs enfants ou ce qui en découle, ou tout un processus. Ajout à la fin de l\'article.',
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

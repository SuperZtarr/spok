/* Aide utilisateur de la vue « Process » (process) : liste des éléments Process de l'espace (ProcessesView) et canevas
   d'un process (ProcessView), où l'on pose des éléments de tous les espaces lisibles et on les relie (2026-11-21 ; avant :
   un process unique par espace). Écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (ViewHelpButton), le tour (useViewOnboarding), le mode Aide (zones data-help-zone="process:*"), l'état vide
   (EmptyHelp mode="process") et les infobulles (clés de `hints`, lues par ProcessView, ProcessesView et
   ProcessUnplacedPanel). Les messages (refus, confirmations) sont aussi ici : jamais de texte en dur dans les composants.
   Vocabulaire unique (2026-11-26) : élément `modes` (sélecteur Lire | Modifier | Composer, ItemModeSwitch), rappels
   readMode / composeMode / openProcessSheet ; annonce item-modes-common (sans date, datée à la MEP). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  liste: {
    title: 'Les process de l\'espace',
    short: 'Chaque process est un élément ; cliquez pour ouvrir son canevas.',
    text: 'Chaque process est un élément de type « Process » : son titre et sa description (le chapeau) se règlent dans sa fiche, accessible par le menu ⋮. Cliquez sur une carte pour ouvrir son canevas. Un espace peut avoir plusieurs process.',
    target: '[data-tour="process-card"]',
    side: 'bottom',
    changes: [{
      id: 'process-item',
      kind: 'evolution',
      text: 'Un process est désormais un élément de type « Process », comme un article : un espace peut en avoir plusieurs, et chacun peut réunir des éléments de tous vos espaces. Les dispositions des anciens process d\'espace ne sont pas reprises.',
      date: '2026-11-21',
    }],
  },
  nouveau: {
    title: 'Nouveau process',
    short: 'Crée un élément Process et ouvre sa fiche.',
    text: 'Crée un élément de type « Process » dans cet espace et ouvre sa fiche pour lui donner un titre ; enregistrez, puis ouvrez son canevas depuis la liste, ou par « Lire » ou « Composer » en haut de la fiche. Une fiche refermée vide n\'est pas gardée.',
    target: '[data-tour="process-new"]',
    noZone: true,
    side: 'bottom',
    changes: [{ id: 'compose-common', kind: 'evolution', text: 'Process : son canevas s\'ouvre par « Composer » en haut de sa fiche, comme les blocs d\'un article ; le titre du canevas rouvre la fiche.', date: '2026-11-25' }],
  },
  modes: {
    title: 'Lire, Modifier, Composer',
    short: 'Passez du canevas en consultation à la fiche ou à la composition.',
    text: 'Le même bandeau que la page d\'un article : « Retour » vous ramène là d\'où vous avez ouvert le process, puis le titre et le sélecteur. Lire : le canevas en consultation, rien ne bouge (c\'est ainsi qu\'il s\'ouvre). Modifier : la fiche du process (titre, description, statut), le canevas restant derrière. Composer : le canevas modifiable, avec le panneau des éléments à poser. Modifier et Composer n\'apparaissent que si vous pouvez modifier le process.',
    target: '[data-tour="process-modes"]',
    noZone: true,
    side: 'bottom',
    changes: [{ id: 'item-modes-common', kind: 'evolution', text: 'Un seul vocabulaire partout : Lire, Modifier, Composer, dans la fiche, sur la page d\'un article et sur le canevas d\'un process, comme dans les menus. Un process s\'ouvre en consultation ; « Composer » le rend modifiable, et « Retour » ramène là d\'où vous venez.', date: '2026-11-27' }],
  },
  panneau: {
    title: 'À ajouter',
    short: 'Les éléments de l\'espace pas encore sur le canevas.',
    text: 'En composition, les éléments de l\'espace du process pas encore sur le canevas, rangés par parent comme dans l\'arborescence (chevrons pour replier) ; la recherche donne une liste à plat. Glissez-en un pour le poser où vous voulez, ou « + » pour le poser au centre. « Ajouter d\'un autre espace » cherche dans vos autres espaces ; « Texte » crée un nouvel élément posé au centre. Le même panneau que pour composer un article.',
    changes: [{ id: 'tray-common', kind: 'evolution', text: 'Les panneaux « À ajouter » d\'un article et d\'un process sont maintenant identiques : même place, mêmes boutons (« + », Texte, Ajouter d\'un autre espace).', date: '2026-11-27' }],
    target: '[data-tour="process-unplaced"]',
    side: 'right',
  },
  ailleurs: {
    title: 'Ajouter d\'un autre espace',
    short: 'Poser un élément venu d\'un autre de vos espaces.',
    text: 'Cherchez un élément dans cette communauté ou dans tous vos espaces, puis « Poser » : il arrive au centre de la vue, d\'où vous le déplacez. L\'élément reste dans son espace ; le process n\'en garde que la place. S\'il est moins visible que le process (espace privé, autre communauté), une confirmation vous le signale : les lecteurs du process verront son titre et son statut, sans accès à l\'élément lui-même.',
    target: '[data-tour="process-elsewhere"]',
    noZone: true,
    side: 'right',
  },
  canevas: {
    title: 'Le canevas',
    short: 'Les éléments posés à la main et leurs relations.',
    text: 'Les éléments posés à la main et leurs relations : rien n\'est rangé automatiquement, la place choisie reste, partagée avec tous les membres de l\'espace du process. Double-cliquez sur le vide pour noter une idée à cet endroit (l\'élément est créé dans l\'espace du process). Cliquez sur une flèche pour modifier ou supprimer la relation ; une bulle sur une flèche signale un commentaire, survolez-la pour le lire.',
    target: '[data-tour="process-canvas"]',
    side: 'left',
  },
  noeud: {
    title: 'Un élément',
    short: 'Déplacez-le, reliez-le, cliquez pour sa fiche.',
    text: 'Déplacez-le à la souris ; cliquez dessus pour ouvrir sa fiche (dans un nouvel onglet s\'il vient d\'un autre espace, rien si cet espace ne vous est pas ouvert). Tirez depuis son bord vers un autre élément pour créer une relation et choisir son type : il faut pouvoir ouvrir l\'élément de départ. « Retirer du process » l\'enlève du canevas sans le supprimer. Statut, déplacement et autres actions se font depuis sa fiche.',
    target: '[data-tour="process-node"]',
    side: 'right',
    changes: [{
      id: 'process-node-click-open',
      kind: 'evolution',
      text: 'Un simple clic sur un item du process ouvre désormais sa fiche, comme dans la carte mentale.',
      date: '2026-11-11',
    }],
  },
  question: {
    title: 'Une question',
    short: 'Un losange : un choix dans le process.',
    text: 'Une question posée sur le canevas s\'affiche en losange, ses réponses possibles en pastilles dessous. Une réponse qui renvoie à un élément posé devient une flèche en pointillés vers lui, étiquetée par la réponse ; une fois la question tranchée, la réponse retenue passe en vert. Ces flèches se règlent dans la fiche de la question (réponses), pas sur le canevas.',
    target: '[data-tour="process-question"]',
    side: 'right',
    changes: [{
      id: 'process-question-diamond',
      kind: 'new',
      text: 'Une question posée dans un process s\'affiche en losange, avec ses réponses en branches vers les éléments auxquels elles renvoient.',
      date: '2026-11-21',
    }],
  },
  indisponible: {
    title: 'Élément indisponible',
    short: 'Un élément que la personne qui l\'a posé ne peut plus lire.',
    text: 'La personne qui a posé cet élément n\'y a plus accès (espace devenu privé, membre retiré) : ni son titre ni ses liens ne sont montrés. « Retirer du process » l\'enlève du canevas ; l\'élément lui-même n\'est pas touché.',
    target: '[data-help-zone="process:indisponible"]',
    side: 'right',
  },
  couloir: {
    title: 'Un couloir',
    short: 'Une bande où ranger visuellement des éléments.',
    text: 'Une bande nommée par un élément (« Définir comme couloir » dans son menu ⋯ ou le panneau), purement visuelle. Glissez-y des éléments ou sortez-les ; le titre ouvre la fiche de l\'élément, et l\'attraper écarte le couloir avec ses éléments. Le chevron le replie en petite boîte : ses éléments sont masqués, leurs liens arrivent sur le couloir (réglage propre à votre navigateur). Le menu du titre le monte, le descend ou le retire, ses éléments restant en place. Tirez une relation vers son entrée (poignée gauche) ou depuis sa sortie (poignée droite) : elle est créée avec l\'élément du couloir ; un lien vers l\'élément d\'un couloir est conservé et arrive sur le couloir, comme vers un sous-processus.',
    target: '[data-tour="process-lane"]',
    side: 'bottom',
  },
  reorganize: {
    title: 'Réorganiser en processus',
    short: 'Ranger les éléments placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet » ; chaque élément reste dans son couloir (remplace la disposition actuelle pour tous les membres)',
    text: 'Range les éléments placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet », chacun dans son couloir ; un couloir écarté est remis dans la pile. La nouvelle disposition est partagée avec tous les membres.',
    target: '[data-tour="process-reorganize"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Process',
  summary: 'Des canevas pour poser des éléments de tous vos espaces et les relier en enchaînement.',
  short: 'Poser et relier librement',
  empty: 'Le process est vide. Glissez un élément depuis le panneau de gauche, ajoutez-en un d\'un autre espace, ou double-cliquez sur le canevas pour noter une idée.',
  ...derived,
  hints: {
    ...derived.hints,
    makeLane: 'Définir comme couloir : cet élément devient une bande où ranger d\'autres éléments',
    // Panneau « À ajouter » (uniformisé avec celui d'un article, 2026-11-26)
    trayEmpty: 'Tous les éléments de l\'espace sont posés sur le canevas.',
    trayDrag: 'glissez-le sur le canevas pour le poser, ou « + » pour le poser au centre',
    trayAdd: 'Pose cet élément au centre de la vue (dans le couloir qui s\'y trouve, le cas échéant). Pour le poser ailleurs, glissez la ligne sur le canevas.',
    addText: 'Texte : crée un nouvel élément dans l\'espace du process et le pose au centre de la vue ; sa fiche s\'ouvre pour l\'écrire.',
    back: 'Retour : revient là d\'où vous avez ouvert le process (vue de l\'espace, liste des process, fiche…), sinon à la vue d\'ouverture de l\'espace. Le canevas reste tel quel.',
    openProcessSheet: 'Modifier : ouvre la fiche de ce process (titre, description, statut…). Le canevas reste affiché derrière.',
    readMode: 'Lire : le canevas en consultation, sans panneau ni déplacement. Rien n\'y est modifié.',
    composeMode: 'Composer : le canevas devient modifiable — poser, déplacer, relier, ranger en couloirs. Les changements sont partagés avec tous les membres.',
    newProcess: 'Nouveau process : crée un élément de type « Process » dans cet espace et ouvre sa fiche',
    listEmpty: 'Un process est un canevas où poser des éléments de tous vos espaces, les ranger en couloirs et les relier. Créez-en un avec « Nouveau process », ou donnez le type « Process » à un élément depuis sa fiche.',
    searchElsewhere: 'Ajouter d\'un autre espace : cherche un élément dans vos autres espaces et le pose au centre de la vue. L\'élément reste dans son espace.',
    searchElsewhereIntro: 'Choisissez un élément : il est posé au centre de la vue, d\'où vous le déplacez. Il reste dans son espace ; seuls les éléments que vous pouvez lire sont proposés.',
    lessVisible: 'Cet élément est moins visible que le process (espace privé ou autre communauté) : les lecteurs du process verront son titre et son statut, sans accès à l\'élément lui-même.',
    isLane: 'Cet élément est déjà un couloir de ce process.',
    relationBlocked: 'Impossible de relier cet élément : son espace ne vous est pas ouvert. La relation se crée depuis un élément que vous pouvez ouvrir.',
    notFound: 'Process introuvable ou inaccessible.',
  },
  tour: [
    {
      popover: {
        title: 'Vue Process',
        description: 'Chaque process est un élément : ouvrez-en un pour poser des éléments de tous vos espaces, puis reliez-les au fil de la réflexion pour construire un enchaînement.',
      },
    },
    ...elementTourSteps('process', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

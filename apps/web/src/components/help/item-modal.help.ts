/* Aide utilisateur de la fiche d'un élément (ItemEditModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (HelpButton), le tour (usePageTourPulse) et le mode Aide : `elements` est exporté, shellZones.ts en dérive les zones item-* correspondantes (posées
   en data-devzone, d'où noZone ici). Registre help/pageHelp.ts.
   hints.copySheet / copySheetDone : infobulle HelpHint du bouton « Copier la fiche » (pied de la modale et mode Afficher).
   hints.copyThumbnail / copyThumbnailDone / copyThumbnailDownloaded / copyThumbnailError : bouton « Copier la vignette » (mêmes endroits).
   Lot 5 contenus multiples : copySheet et annonce copy-sheet-all-contents (élément actions) — tous les contenus copiés.
   hints.readMode / readModeUnsaved / editMode / sheetMode / composeMode / composeModeUnsaved : sélecteur Afficher / Modifier / Composer (data-tour item-mode-switch) ;
   hints.print : Imprimer du mode Afficher.
   hints.unsavedLeave / unsavedSaveAndLeave : boutons de la confirmation de fermeture (useUnsavedGuard) ; annonce unsaved-save-and-leave sans date.
   Lot 4 (panneau compact) : texte de l'élément dates, hints.datesSummary, annonce item-panel-compact (élément dates, sans date) ; fields lus en rappel au survol des libellés.
   Lot 3 (deux colonnes) : textes champs et historique, hints.actionCopyId / copyIdDone, annonce item-two-columns (élément champs, sans date).
   hints.moreFields / lessFields + annonce item-header-common (élément titre, sans date) : en-tête commun, lot 2 de la réorganisation.
   Élément actions + hints.action* : pied commun et menu « Actions » (itemSheetActions.ts) ; annonce item-actions-menu sans date.
   Élément references + fields.externalRefs : champ Références externes (ExternalRefsField) ; annonce item-external-refs sans date.
   Élément brouillon + hints.draftExplain / draftChangedSince / draftResume / draftDiscard : bandeau ItemDraftBanner (lib/itemDraft.ts) ; annonce item-draft-local sans date.
   Élément historique + hints.historyToggle / historyEmpty : section Historique (ItemHistorySection) ; annonce item-history-members sans date.
   hints.contributionVote / contributionVotePending : vote gardé par chaque contribution (ContributionVoteBadge) ; annonce contribution-vote-kept sans date.
   Aide par section (2026-11-12) : chaque élément est aussi lu par le « ? » de sa section (help/ElementHelp, posé dans ItemEditModal — sauf
   insertion, déjà expliqué par les infobulles de la barre d'insertion répétée entre les blocs) ; hints.sectionHelp = phrase du « ? » compact de l'en-tête.
   Annonce item-section-help sans date : la session MEP la date. Annonce `item-types-simplified` (lot 4 contenus multiples) sans date : la session MEP la date. La clé `contentTypes` de l'élément est lue par ItemEditModal : ne pas la renommer. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

export const elements = {
  chemin: {
    title: 'Fil d\'Ariane',
    short: 'Communauté, espace et parents de l\'élément.',
    text: 'Communauté → Espace → Parents. Cliquez sur l\'espace pour y retourner, ou sur un parent pour naviguer dans la hiérarchie.',
    target: '[data-tour="item-breadcrumb"]',
    noZone: true,
    side: 'bottom',
  },
  titre: {
    title: 'Titre',
    short: 'Cliquez pour modifier le titre.',
    text: 'Cliquez pour modifier le titre. L\'icône à gauche indique le type de l\'élément.',
    changes: [{ id: 'item-header-common', kind: 'evolution', text: 'En-tête de la fiche réorganisé, le même dans tous les modes : le chemin, puis le titre sur toute la largeur, puis les modes, « Plus de champs » et un seul « ? » pour l\'aide et le tutoriel.', date: '2026-11-13' }],
    target: '[data-tour="item-title"]',
    noZone: true,
    side: 'bottom',
  },
  modes: {
    title: 'Modes de la fiche',
    short: 'Afficher, Modifier ou Composer.',
    text: 'Afficher présente l\'élément comme un document : description mise en forme, contenus (images, schémas) en grand, prête à copier ou imprimer. Modifier (ou Fiche si vous n\'avez pas le droit de modifier) revient à la fiche complète. Sur un article que vous pouvez modifier, Composer travaille ses blocs. Le menu ⋮ des vues propose directement « Afficher » ou « Ouvrir ».',
    target: '[data-tour="item-mode-switch"]',
    noZone: true,
    side: 'bottom',
    changes: [{ id: 'item-section-help', kind: 'evolution', text: 'Chaque section de la fiche a son propre « ? », qui explique cette seule section. Le « ? » en haut à droite garde le tutoriel et le mode Aide.', date: '2026-11-11' }],
  },
  insertion: {
    title: 'Insérer un bloc',
    short: 'Ajoutez un élément ou du texte à l\'article.',
    text: 'En mode Composer : « Élément » ouvre le sélecteur (parcourir les espaces, cocher un ou plusieurs éléments, ou prendre un processus) ; « Texte » crée une note. Un ajout groupé est confirmé avec le nombre d\'éléments.',
    target: '[data-tour="article-insert"]',
    noZone: true,
    side: 'top',
  },
  // Présent dans tous les modes ; fiche réduite, les étapes Type → Relations n'apparaissent qu'une fois dépliée (Tags : toujours)
  champs: {
    title: 'Plus de champs',
    short: 'Déplie ou replie la fiche.',
    text: 'Dépliez la fiche (« Plus de champs ») pour ouvrir à droite le panneau Pilotage : type, statut, priorité, dates, assignation, parent, références externes, dépendances, enfants et historique. « Moins de champs » le referme. La colonne de gauche ne change pas : tags, description, contenus et contributions restent au même endroit. La fiche s\'ouvre réduite en mode Forum et Loisirs, complète dans les autres modes.',
    target: '[data-tour="item-more-fields"]',
    noZone: true,
    side: 'bottom',
    changes: [{ id: 'item-two-columns', kind: 'evolution', text: 'Fiche complète en deux colonnes : la colonne de gauche est la même qu\'en fiche réduite (tags, description, contenus, contributions), « Plus de champs » ajoute à droite le panneau Pilotage. L\'identifiant se copie depuis le menu Actions.', date: '2026-11-13' }],
  },
  type: {
    title: 'Type',
    short: 'La nature de l\'élément.',
    text: 'La nature de l\'élément : Élément (par défaut : texte, image, fichier, lien…), Tâche, Projet, Réunion, Période, Article ou Question. Elle détermine les statuts proposés et le rangement dans les vues. Ce que l\'élément porte (images, fichiers, liens, schémas) se joint dans la zone « Contenus » ; son classement (ex. « bug », « config ») passe par les tags.',
    changes: [{ id: 'item-types-simplified', kind: 'evolution', text: 'Types simplifiés : Note, Image, Lien, Document et Diagramme deviennent des « Éléments » (leurs médias sont des contenus) ; une anomalie est une Tâche taguée « bug », une configuration un Élément tagué « config ».', date: '2026-11-11' }],
    target: '[data-tour="item-type-selector"]',
    noZone: true,
    side: 'bottom',
  },
  contentTypes: {
    title: 'Type de contenu',
    short: 'Type de l\'élément : Élément (par défaut : un texte, une photo, un fichier ou un lien), Article (assemblage d\'éléments) ou Question, enregistré avec « Enregistrer ». Quel que soit le type, fichiers, images, liens et schémas se joignent dans la zone « Contenus » sous la description (enregistrés tout de suite). Tâches, projets, dates et statuts : « Plus de champs ».',
    text: 'Fiche réduite : choisissez Élément, Article ou Question. Fichiers, images, liens et schémas se joignent dans la zone « Contenus », quel que soit le type.',
    target: '[data-tour="item-content-types"]',
    noZone: true,
    side: 'bottom',
  },
  description: {
    title: 'Description',
    short: 'Le texte de l\'élément.',
    text: 'Éditeur riche : texte formaté, liens, images, @mentions de membres et #références d\'items.',
    target: '[data-tour="item-description"]',
    noZone: true,
    side: 'right',
  },
  reactions: {
    title: 'Réactions',
    short: 'Votre avis d\'un clic.',
    text: 'Exprimez votre avis d\'un clic : utile, intéressant, urgent… Cliquez le smiley pour choisir. Réservé aux utilisateurs connectés : un visiteur voit seulement les compteurs.',
    target: '[data-tour="item-reactions"]',
    noZone: true,
    side: 'top',
  },
  contributions: {
    title: 'Contributions',
    short: 'Discussions sur cet élément.',
    text: 'Discussions et commentaires sur cet élément. Pour contribuer, choisissez d\'abord votre vote (Contribution, Pertinent, Trollage…) : la contribution le garde et l\'affiche après votre nom, même si vous votez autrement ensuite. Chaque contribution a aussi ses propres réactions.',
    target: '[data-tour="item-contributions"]',
    noZone: true,
    side: 'top',
    changes: [{
      id: 'contribution-vote-kept',
      kind: 'evolution',
      text: 'Chaque contribution garde le vote avec lequel elle a été écrite (Pertinent, Trollage…), affiché après le nom de son auteur.',
      date: '2026-11-12',
    }],
  },
  brouillon: {
    title: 'Saisie retrouvée',
    short: 'Vos modifications non enregistrées, gardées par le navigateur.',
    text: 'Tant qu\'une fiche a des modifications non enregistrées (champs, contribution en cours), le navigateur en garde une copie. Si la session expire, si le réseau coupe ou si la fiche se ferme sans enregistrer (croix, Échap), un bandeau la propose à la prochaine ouverture : « Reprendre » remet la saisie, à enregistrer ensuite ; « Ignorer » l\'efface. La copie est propre à votre compte et à ce navigateur, effacée après enregistrement, « Quitter sans enregistrer » ou au bout de 7 jours.',
    target: '[data-tour="item-draft"]',
    noZone: true,
    side: 'bottom',
    changes: [{
      id: 'item-draft-local',
      kind: 'new',
      text: 'Une saisie non enregistrée n\'est plus perdue (session expirée, coupure, fiche fermée) : à la réouverture, la fiche propose de la reprendre.',
      date: '2026-11-12',
    }],
  },
  historique: {
    title: 'Historique',
    short: 'Qui a changé quoi, et quand.',
    text: 'Dépliez « Historique » (en bas de la fiche réduite, en bas du panneau Pilotage de la fiche complète) pour voir les changements de l\'élément, du plus récent au plus ancien : création, titre, type, statut, priorité, dates, parent, assigné, tags, description, contenus (images, fichiers, liens, schémas) et relations, avec leur auteur et leur date. Visible par toute personne qui peut lire l\'élément ; rien ne s\'y modifie. Les tags, l\'assigné et les contenus y figurent depuis le 12/11/2026.',
    target: '[data-tour="item-history"]',
    noZone: true,
    side: 'top',
    changes: [{
      id: 'item-history-members',
      kind: 'new',
      text: 'Nouvelle section « Historique » en bas de la fiche : qui a changé le statut, les dates, les tags, les contenus… et quand.',
      date: '2026-11-12',
    }],
  },
  statut: {
    title: 'Statut',
    short: 'L\'avancement de l\'élément.',
    text: 'L\'avancement de l\'élément : cliquez sur un statut pour le sélectionner (À faire, En cours, Terminé, À valider…). Il définit sa colonne dans le Kanban. Un statut Terminé ou Annulé remplit la date de fin si elle est vide, tout statut remplit la date de début vide, « Non défini » efface les deux — comme depuis le Kanban ou le menu ⋮.',
    target: '[data-tour="item-status"]',
    noZone: true,
    side: 'left',
  },
  dates: {
    title: 'Dates',
    short: 'Début, fin et échéance.',
    text: 'Date de début, de fin et d\'échéance, résumées sur une ligne : cliquez dessus pour les déplier et les modifier (« Replier les dates » les referme). Elles déterminent l\'affichage dans le calendrier, le Gantt et le planning. Dans le sélecteur, les flèches changent le mois et la liste à côté du mois choisit l\'année. Survolez un libellé (Début, Échéance…) pour son explication.',
    target: '[data-tour="item-dates"]',
    noZone: true,
    side: 'left',
    changes: [{ id: 'item-panel-compact', kind: 'evolution', text: 'Panneau Pilotage plus compact : les dates tiennent sur une ligne et se déplient au clic, les explications des champs apparaissent au survol de leur nom, et le panneau défile indépendamment de la description.', date: '2026-11-13' }],
  },
  relations: {
    title: 'Relations',
    short: 'Les liens avec d\'autres éléments.',
    text: 'Liez cet élément à d\'autres, sans lien de parenté, de cet espace, de la communauté ou de tous vos espaces : bloque, permet, entraîne (décaler l\'un décale l\'autre) ou lié à. Ajoutez un commentaire sur chaque relation.',
    target: '[data-tour="item-relations"]',
    noZone: true,
    side: 'left',
  },
  tags: {
    title: 'Tags',
    short: 'Les étiquettes de l\'élément.',
    text: 'Classez avec des tags, pour retrouver et filtrer l\'élément (ex. « bug » pour une anomalie, « config » pour une configuration). Toujours visibles, fiche réduite ou complète, et en couleur en mode Afficher. Sont proposés, groupés par portée : les tags globaux (communs à tout SPOK), ceux de la communauté, et ceux de l\'espace et de ses espaces parents (badge « cet espace » ou nom de l\'espace parent). Un tag créé en tapant appartient à l\'espace de l\'élément : il est proposé dans cet espace et tous ses sous-espaces, pas ailleurs.',
    changes: [
      { id: 'item-tags-always-visible', kind: 'evolution', text: 'Les tags sont toujours visibles dans la fiche, même réduite, et en couleur en mode Afficher. Un tag créé dans un espace de communauté est partagé par tous ses espaces.', date: '2026-11-11' },
      { id: 'item-tags-space-scope', kind: 'evolution', text: 'Tags d\'espace de retour : un tag créé depuis la fiche appartient à l\'espace et à ses sous-espaces. Le sélecteur range les tags par portée : globaux, communauté, espace.', date: '2026-11-12' },
    ],
    target: '[data-tour="item-tags"]',
    noZone: true,
    side: 'left',
  },
  references: {
    title: 'Références externes',
    short: 'Les identifiants de l\'élément dans d\'autres outils.',
    text: 'Notez où l\'élément existe ailleurs, sur une ligne : « Appli1 : Réf1 | appli2 : réf2 » — le nom de l\'outil, deux-points, la référence, et une barre verticale entre deux références (ex. « Jira : PROJ-12 | Salesforce : 0000575747 »). Enregistrées avec « Enregistrer », affichées avec le nom de l\'outil en gras, reprises dans le mode Afficher et « Copier la fiche », et retrouvées par la recherche (une partie suffit).',
    target: '[data-tour="item-external-refs"]',
    noZone: true,
    side: 'left',
    changes: [{
      id: 'item-external-refs',
      kind: 'new',
      text: 'Nouveau champ « Références externes » (fiche complète) : notez les identifiants de l\'élément dans d\'autres outils, « Jira : PROJ-12 | Salesforce : 0000575747 », et retrouvez-le par la recherche.',
      date: '2026-11-12',
    }],
  },
  enfants: {
    title: 'Éléments enfants',
    short: 'Les sous-éléments de cet élément.',
    text: 'Les sous-éléments de cet élément. Cliquez pour naviguer. Le compteur indique les petits-enfants.',
    target: '[data-tour="item-children"]',
    noZone: true,
    side: 'top',
  },
  actions: {
    title: 'Actions',
    short: 'Enregistrer, fermer et autres actions.',
    text: 'Le pied est le même dans tous les modes. À gauche : « Enregistrer » garde la fiche ouverte, « Enregistrer et quitter » la ferme, « Fermer » demande quoi faire s\'il reste des modifications. À droite, le menu « Actions » regroupe le reste, avec un libellé et un rappel pour chaque entrée : imprimer, exporter en PDF, copier la fiche ou sa vignette, épingler, dupliquer, déplacer, réorganiser (absorber, éclater, fusionner, modèles) et supprimer.',
    target: '[data-tour="item-actions"]',
    noZone: true,
    side: 'top',
    changes: [{
      id: 'copy-sheet-all-contents',
      kind: 'evolution',
      text: '« Copier la fiche » reprend désormais tous les contenus de l\'élément (images, fichiers, liens, schémas), et non plus le seul média principal.',
      date: '2026-11-11',
    }, {
      id: 'unsaved-save-and-leave',
      kind: 'evolution',
      text: 'En fermant une fiche modifiée, la confirmation propose aussi « Enregistrer et quitter » : plus besoin de revenir à la fiche pour enregistrer.',
      date: '2026-11-12',
    }, {
      id: 'item-actions-menu',
      kind: 'evolution',
      text: 'Le pied de la fiche est simplifié : les icônes sans nom sont rangées dans un menu « Actions » (en bas à droite), avec un libellé et une explication pour chacune. Le même pied sert en mode Afficher.',
      date: '2026-11-13',
    }],
  },
} satisfies HelpElements;

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Fiche élément',
  summary: 'Toutes les informations d\'un élément : description, contributions, relations, tags, dates et priorité.',
  ...derived,
  hints: {
    ...derived.hints,
    sectionHelp: 'Chaque section de la fiche a son petit « ? » : cliquez-le pour savoir à quoi elle sert et comment s\'en servir.',
    saveAndClose: 'Enregistrer et quitter : enregistre les modifications puis ferme la fiche (touche Entrée dans un champ : même effet).',
    save: 'Enregistrer : enregistre les modifications et garde la fiche ouverte pour continuer (raccourci Ctrl+S).',
    datesSummary: 'Cliquez pour déplier les dates et les modifier. Rien n\'est modifié tant que vous n\'enregistrez pas.',
    moreFields: 'Plus de champs : affiche aussi le type, le statut, la priorité, les dates, l\'assignation, les relations et l\'historique. Rien n\'est modifié.',
    lessFields: 'Moins de champs : revient à la fiche réduite (titre, tags, description, contenus, contributions). Rien n\'est modifié.',
    actionCopyId: 'Copier l\'identifiant : met l\'identifiant technique de l\'élément dans le presse-papier (utile pour le MCP ou un signalement). Rien n\'est modifié.',
    copyIdDone: 'Identifiant copié',
    actionExportPdf: 'Exporter en PDF : télécharge la fiche en PDF (champs, description, enfants). Rien n\'est modifié dans SPOK.',
    actionBookmark: 'Épingler : ajoute l\'élément à vos épingles (ou l\'en retire). Personnel : les autres membres ne le voient pas.',
    actionMarkUnread: 'Marquer comme non lu : l\'élément redevient « non lu » pour vous seul, et la fiche se ferme.',
    actionDuplicate: 'Dupliquer vers un espace : choisissez l\'espace où créer une copie. L\'original ne change pas.',
    actionMove: 'Déplacer vers un espace : choisissez l\'espace où l\'élément est déplacé.',
    actionConvert: 'Convertir en espace : propose de transformer l\'élément en espace ; une confirmation est demandée.',
    actionAbsorb: 'Absorber les enfants : verse le contenu des enfants dans cet élément puis les supprime, tout de suite, sans confirmation.',
    actionSplit: 'Éclater en sous-éléments : crée un sous-élément par titre de la description, tout de suite, sans confirmation.',
    actionMerge: 'Fusionner avec… : choisissez l\'élément à réunir avec celui-ci ; une confirmation est demandée.',
    actionSaveTemplate: 'Enregistrer comme modèle : garde l\'élément et ses enfants (titres et types) comme modèle réutilisable.',
    actionInsertTemplate: 'Ajouter une structure : crée sous cet élément les enfants d\'un modèle choisi.',
    actionDelete: 'Supprimer : ouvre la confirmation de suppression (avec ou sans ses enfants).',
    contributionVote: 'Le vote choisi par l\'auteur en écrivant cette contribution. Il ne change plus, même si l\'auteur vote autrement ensuite.',
    contributionVotePending: 'Ce vote sera enregistré avec votre contribution et affiché après votre nom. Pour en changer, annulez et choisissez un autre vote.',
    draftExplain: 'Reprendre remet cette saisie dans la fiche ; rien n\'est enregistré tant que vous ne cliquez pas sur Enregistrer. Ignorer l\'efface définitivement.',
    draftChangedSince: 'Attention : l\'élément a été modifié depuis par ailleurs. Après Reprendre, vérifiez les champs avant d\'enregistrer : votre saisie remplacerait ces changements.',
    draftResume: 'Reprendre : remplit la fiche avec la saisie retrouvée (champs et contribution en cours). Rien n\'est enregistré avant Enregistrer.',
    draftDiscard: 'Ignorer : efface la saisie retrouvée de ce navigateur. La fiche garde la version enregistrée.',
    historyToggle: 'Historique : affiche ou masque les changements de l\'élément (auteur, date, avant → après). Consultation seule : rien n\'est modifié.',
    historyEmpty: 'Aucun changement enregistré pour cet élément.',
    unsavedLeave:'Quitter sans enregistrer : ferme la fiche et abandonne les modifications en attente. Ce qui était déjà enregistré ne change pas.',
    unsavedSaveAndLeave: 'Enregistrer et quitter : enregistre les modifications puis ferme la fiche. Si l\'enregistrement échoue (élément modifié entre-temps par quelqu\'un d\'autre), la fiche reste ouverte.',
    openArticleUnsaved: 'Enregistrement de l\'article… Le mode Composer (choix et mise en page des blocs) s\'active dès qu\'il est enregistré avec le type « Article », sans modification en attente.',
    copySheet: 'Copier la fiche : met dans le presse-papier le titre, les champs renseignés, tous les contenus (images, fichiers, liens, schémas), la description, les enfants, relations et contributions. Collée dans Word, un mail ou Notion, elle garde sa mise en forme et ses images ; un fichier joint devient un lien vers le fichier. Dans un éditeur de texte simple, c\'est la version Markdown (adresses des images). Rien n\'est modifié dans SPOK.',
    copySheetDone: 'Fiche copiée',
    copyThumbnail: 'Copier la vignette : met dans le presse-papier une image PNG de l\'élément (type, statut, titre, image ou début de la description, espace, dates, assigné), à coller dans Teams, Slack, un mail ou PowerPoint. L\'image reflète la version enregistrée. Rien n\'est modifié dans SPOK.',
    copyThumbnailDone: 'Vignette copiée',
    copyThumbnailDownloaded: 'Le navigateur a refusé la copie : image téléchargée.',
    copyThumbnailError: 'Vignette impossible à créer. Réessayez.',
    print: 'Imprimer : ouvre la fiche dans une fenêtre d\'impression (ou d\'enregistrement en PDF). Rien n\'est modifié dans SPOK.',
    readMode: 'Afficher : l\'élément en lecture, mis en page comme un document (images et schémas en grand, puis fichiers et liens). Rien ne peut y être modifié.',
    readModeUnsaved: 'Enregistrez d\'abord vos modifications : la lecture montre la version enregistrée.',
    editMode: 'Modifier : la fiche complète, avec tous les champs modifiables.',
    composeMode: 'Composer : ajouter, réordonner, régler ou retirer les blocs de l\'article (éléments existants mis bout à bout). Les éléments eux-mêmes restent à leur place.',
    composeModeUnsaved: 'Enregistrez d\'abord vos modifications pour passer en mode Composer.',
    sheetMode: 'Fiche : tous les champs de l\'élément, en lecture seule (vous n\'avez pas le droit de le modifier).',
  },
  fields: {
    startEnd: 'Début et fin : la période pendant laquelle l\'élément a lieu (barre du Gantt, calendrier).',
    dueDate: 'La date limite à respecter : elle classe l\'élément dans le Planning et le signale en retard une fois dépassée.',
    priority: 'De P1 (urgente) à P4 (basse) : sert au tri et à la vue Priorité.',
    parent: 'L\'élément sous lequel celui-ci se range, dans le même espace : il en devient un sous-élément.',
    externalRefs: 'Format : « Outil : référence », une barre « | » entre deux références. Ex. : Jira : PROJ-12 | Salesforce : 0000575747.',
    assignee: 'La personne chargée de l\'élément. Un membre de l\'espace le voit dans ses tâches (« Mes tâches », « Ma journée ») et peut le modifier. Vous pouvez aussi saisir le nom d\'une personne sans compte SPOK : elle n\'est que nommée, sans droit ni notification.',
  },
  tour: elementTourSteps('item-modal', elements),
};

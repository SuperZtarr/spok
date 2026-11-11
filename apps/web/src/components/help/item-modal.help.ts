/* Aide utilisateur de la fiche d'un élément (ItemEditModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (HelpButton), le tour (usePageTourPulse) et le mode Aide : `elements` est exporté, shellZones.ts en dérive les zones item-* correspondantes (posées
   en data-devzone, d'où noZone ici). Registre help/pageHelp.ts.
   hints.copySheet / copySheetDone : infobulle HelpHint du bouton « Copier la fiche » (pied de la modale et mode Afficher).
   hints.copyThumbnail / copyThumbnailDone / copyThumbnailDownloaded / copyThumbnailError : bouton « Copier la vignette » (mêmes endroits).
   Lot 5 contenus multiples : copySheet et annonce copy-sheet-all-contents (élément actions) — tous les contenus copiés.
   hints.readMode / readModeUnsaved / editMode / sheetMode / composeMode / composeModeUnsaved : sélecteur Afficher / Modifier / Composer (data-tour item-mode-switch) ;
   hints.print : Imprimer du mode Afficher. Annonce `item-types-simplified` (lot 4 contenus multiples) sans date : la session MEP la date. La clé `contentTypes` de l'élément est lue par ItemEditModal : ne pas la renommer. */
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
    text: 'Dépliez la fiche pour voir et modifier le type, le statut, les dates et les relations, ou repliez-la (« Moins de champs ») pour ne garder que le titre, les tags, la description et les contributions. Elle s\'ouvre réduite en mode Forum et Loisirs, complète dans les autres modes.',
    target: '[data-tour="item-more-fields"]',
    noZone: true,
    side: 'bottom',
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
    text: 'Discussions et commentaires sur cet élément. Chaque contribution a ses propres réactions.',
    target: '[data-tour="item-contributions"]',
    noZone: true,
    side: 'top',
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
    text: 'Date de début, de fin et d\'échéance. Elles déterminent l\'affichage dans le calendrier, le Gantt et le planning. Dans le sélecteur, les flèches changent le mois et la liste à côté du mois choisit l\'année.',
    target: '[data-tour="item-dates"]',
    noZone: true,
    side: 'left',
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
    text: 'Classez avec des tags, pour retrouver et filtrer l\'élément (ex. « bug » pour une anomalie, « config » pour une configuration). Toujours visibles, fiche réduite ou complète, et en couleur en mode Afficher. Les tags de l\'espace et de sa communauté sont proposés ; un tag créé en tapant rejoint la communauté de l\'espace (sinon l\'espace) et devient disponible dans tous ses espaces.',
    changes: [{ id: 'item-tags-always-visible', kind: 'evolution', text: 'Les tags sont toujours visibles dans la fiche, même réduite, et en couleur en mode Afficher. Un tag créé dans un espace de communauté est partagé par tous ses espaces.', date: '2026-11-11' }],
    target: '[data-tour="item-tags"]',
    noZone: true,
    side: 'left',
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
    text: '« Enregistrer » garde la fiche ouverte, « Enregistrer et quitter » la ferme. Ici aussi : annuler, supprimer, imprimer, exporter en PDF, copier la fiche pour la coller ailleurs (Word, mail, Notion), avec tous ses contenus, ou copier sa vignette en image.',
    target: '[data-tour="item-actions"]',
    noZone: true,
    side: 'top',
    changes: [{
      id: 'copy-sheet-all-contents',
      kind: 'evolution',
      text: '« Copier la fiche » reprend désormais tous les contenus de l\'élément (images, fichiers, liens, schémas), et non plus le seul média principal.',
      date: '2026-11-11',
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
    saveAndClose: 'Enregistrer et quitter : enregistre les modifications puis ferme la fiche (touche Entrée dans un champ : même effet).',
    save: 'Enregistrer : enregistre les modifications et garde la fiche ouverte pour continuer (raccourci Ctrl+S).',
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
    assignee: 'La personne chargée de l\'élément. Un membre de l\'espace le voit dans ses tâches (« Mes tâches », « Ma journée ») et peut le modifier. Vous pouvez aussi saisir le nom d\'une personne sans compte SPOK : elle n\'est que nommée, sans droit ni notification.',
  },
  tour: elementTourSteps('item-modal', elements),
};

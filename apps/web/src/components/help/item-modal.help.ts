/* Aide utilisateur de la fiche d'un élément (ItemEditModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (HelpButton), le tour (usePageTourPulse) et le mode Aide : `elements` est exporté, shellZones.ts en dérive les zones item-* correspondantes (posées
   en data-devzone, d'où noZone ici). Registre help/pageHelp.ts.
   hints.copySheet / copySheetDone : infobulle HelpHint du bouton « Copier la fiche » (pied de la modale et mode Afficher).
   hints.copyThumbnail / copyThumbnailDone / copyThumbnailDownloaded / copyThumbnailError : bouton « Copier la vignette » (mêmes endroits).
   hints.readMode / readModeUnsaved / editMode / sheetMode / composeMode / composeModeUnsaved : sélecteur Afficher / Modifier / Composer (data-tour item-mode-switch) ;
   hints.print : Imprimer du mode Afficher. La clé `contentTypes` de l'élément est lue par ItemEditModal : ne pas la renommer. */
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
    text: 'Afficher présente l\'élément comme un document : média en grand, description mise en forme, prête à copier ou imprimer. Modifier (ou Fiche si vous n\'avez pas le droit de modifier) revient à la fiche complète. Sur un article que vous pouvez modifier, Composer travaille ses blocs. Le menu ⋮ des vues propose directement « Afficher » ou « Ouvrir ».',
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
  // Présent dans tous les modes ; fiche réduite, les étapes Type → Tags n'apparaissent qu'une fois dépliée
  champs: {
    title: 'Plus de champs',
    short: 'Déplie ou replie la fiche.',
    text: 'Dépliez la fiche pour voir et modifier le type, le statut, les dates, les relations et les tags, ou repliez-la (« Moins de champs ») pour ne garder que le titre, la description et les contributions. Elle s\'ouvre réduite en mode Forum et Loisirs, complète dans les autres modes.',
    target: '[data-tour="item-more-fields"]',
    noZone: true,
    side: 'bottom',
  },
  type: {
    title: 'Type',
    short: 'La nature de l\'élément.',
    text: 'La nature de l\'élément : Note, Tâche, Projet, Réunion, Document, Diagramme, etc. Elle détermine les statuts proposés et le rangement dans les vues.',
    target: '[data-tour="item-type-selector"]',
    noZone: true,
    side: 'bottom',
  },
  contentTypes: {
    title: 'Type de contenu',
    short: 'Type de l\'élément : Note (texte), Lien (une adresse), Document (un fichier joint), Image, Schéma (dessiné dans SPOK) ou Article (assemblage d\'éléments). Le choisir fait apparaître sa zone sous la description ; le type est enregistré avec « Enregistrer » (un fichier envoyé, lui, est enregistré tout de suite). Tâches, projets, dates et statuts : « Plus de champs ».',
    text: 'Fiche réduite : choisissez Note, Lien, Document, Image, Schéma ou Article ; la zone correspondante apparaît sous la description.',
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
    text: 'L\'avancement de l\'élément : cliquez sur un statut pour le sélectionner (À faire, En cours, Terminé, À valider…). Il définit sa colonne dans le Kanban.',
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
    text: 'Classez avec des tags, pour retrouver et filtrer l\'élément. Les tags d\'espace et de communauté sont disponibles. Créez-en de nouveaux en tapant.',
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
    text: '« Enregistrer » garde la fiche ouverte, « Enregistrer et quitter » la ferme. Ici aussi : annuler, supprimer, imprimer, exporter en PDF, copier la fiche pour la coller ailleurs (Word, mail, Notion) ou copier sa vignette en image.',
    target: '[data-tour="item-actions"]',
    noZone: true,
    side: 'top',
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
    openArticleUnsaved: 'Enregistrez d\'abord l\'élément : le mode Composer (choix et mise en page des blocs) s\'active une fois qu\'il est enregistré avec le type « Article ».',
    copySheet: 'Copier la fiche : met dans le presse-papier le titre, les champs renseignés, la description, l\'image ou le schéma, les enfants, relations et contributions. Collée dans Word, un mail ou Notion, elle garde sa mise en forme et l\'image ; un document joint devient un lien vers le fichier. Dans un éditeur de texte simple, c\'est la version Markdown (adresses des images). Rien n\'est modifié dans SPOK.',
    copySheetDone: 'Fiche copiée',
    copyThumbnail: 'Copier la vignette : met dans le presse-papier une image PNG de l\'élément (type, statut, titre, image ou début de la description, espace, dates, assigné), à coller dans Teams, Slack, un mail ou PowerPoint. L\'image reflète la version enregistrée. Rien n\'est modifié dans SPOK.',
    copyThumbnailDone: 'Vignette copiée',
    copyThumbnailDownloaded: 'Le navigateur a refusé la copie : image téléchargée.',
    copyThumbnailError: 'Vignette impossible à créer. Réessayez.',
    print: 'Imprimer : ouvre la fiche dans une fenêtre d\'impression (ou d\'enregistrement en PDF). Rien n\'est modifié dans SPOK.',
    readMode: 'Afficher : l\'élément en lecture, mis en page comme un document (image ou schéma en grand). C\'est exactement ce que copie « Copier la fiche ». Rien ne peut y être modifié.',
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

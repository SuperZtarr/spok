/* Aide utilisateur de la fiche d'un élément (ItemEditModal).
   Lue par le point d'interrogation de l'écran (HelpButton) et le tour (usePageTourPulse) — registre help/pageHelp.ts.
   hints.copySheet / copySheetDone : infobulle HelpHint du bouton « Copier la fiche » (pied de la modale et mode Afficher).
   hints.readMode / readModeUnsaved / editMode / sheetMode : sélecteur Afficher / Modifier (data-tour item-mode-switch) ;
   hints.print : Imprimer du mode Afficher. zones read-media / read-content : mode Aide sur ItemReadView. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Fiche élément',
  summary: 'Toutes les informations d\'un élément : description, contributions, relations, tags, dates et priorité.',
  tips: [
    'Utilisez @mentions et #références dans la description',
    'Ajoutez des réactions pour donner votre avis (une fois connecté — un visiteur voit seulement les compteurs)',
    'Les contributions permettent de discuter sur l\'élément',
    'Créez des relations pour lier les éléments entre eux',
    'Les enfants sont listés en bas de la fiche',
    '« Plus de champs » affiche type, statut, dates, relations et tags ; « Moins de champs » les masque (fiche ouverte réduite en Forum et JDR, complète ailleurs)',
  ],
  tour: [
    {
      element: '[data-tour="item-breadcrumb"]',
      popover: {
        title: 'Fil d\'Ariane',
        description: 'Communauté → Espace → Parents. Cliquez sur l\'espace pour y retourner, ou sur un parent pour naviguer dans la hiérarchie.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="item-title"]',
      popover: {
        title: 'Titre',
        description: 'Cliquez pour modifier le titre. L\'icône à gauche indique le type de l\'élément.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="item-mode-switch"]',
      popover: {
        title: 'Afficher / Modifier',
        description: 'Afficher présente l\'élément comme un document : média en grand, description mise en forme, prête à copier ou imprimer. Modifier (ou Fiche si vous n\'avez pas le droit de modifier) revient à la fiche complète. Le menu ⋮ des vues propose directement « Afficher » ou « Ouvrir ».',
        side: 'bottom',
      },
    },
    {
      // Présent dans tous les modes ; fiche réduite, les étapes Type → Tags n'apparaissent qu'une fois dépliée
      element: '[data-tour="item-more-fields"]',
      popover: {
        title: 'Plus de champs / Moins de champs',
        description: 'Dépliez la fiche pour voir et modifier le type, le statut, les dates, les relations et les tags, ou repliez-la pour ne garder que le titre, la description et les contributions. Elle s\'ouvre réduite en mode Forum et JDR, complète dans les autres modes.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="item-type-selector"]',
      popover: {
        title: 'Type',
        description: 'Changez le type de l\'élément : Note, Tâche, Projet, Réunion, Document, Diagramme, etc.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="item-description"]',
      popover: {
        title: 'Description',
        description: 'Éditeur riche : texte formaté, liens, images, @mentions de membres et #références d\'items.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="item-reactions"]',
      popover: {
        title: 'Réactions',
        description: 'Exprimez votre avis d\'un clic : utile, intéressant, urgent… Cliquez le smiley pour choisir. Réservé aux utilisateurs connectés : un visiteur voit seulement les compteurs.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="item-contributions"]',
      popover: {
        title: 'Contributions',
        description: 'Discussions et commentaires sur cet élément. Chaque contribution a ses propres réactions.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="item-status"]',
      popover: {
        title: 'Statut',
        description: 'Cliquez sur un statut pour le sélectionner : À faire, En cours, Terminé, À valider…',
        side: 'left',
      },
    },
    {
      element: '[data-tour="item-dates"]',
      popover: {
        title: 'Dates',
        description: 'Date de début, de fin et d\'échéance. Elles déterminent l\'affichage dans le calendrier, le Gantt et le planning.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="item-relations"]',
      popover: {
        title: 'Relations',
        description: 'Liez cet élément à d\'autres : bloque, permet, entraîne (décaler l\'un décale l\'autre) ou lié à. Ajoutez un commentaire sur chaque relation.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="item-tags"]',
      popover: {
        title: 'Tags',
        description: 'Classez avec des tags. Les tags d\'espace et de communauté sont disponibles. Créez-en de nouveaux en tapant.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="item-children"]',
      popover: {
        title: 'Éléments enfants',
        description: 'Les sous-éléments de cet item. Cliquez pour naviguer. Le compteur indique les petits-enfants.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="item-actions"]',
      popover: {
        title: 'Actions',
        description: 'Enregistrez, annulez, supprimez, imprimez, exportez en PDF ou copiez la fiche pour la coller ailleurs (Word, mail, Notion).',
        side: 'top',
      },
    },
  ],
  hints: {
    copySheet: 'Copier la fiche : met dans le presse-papier le titre, les champs renseignés, la description, l\'image ou le schéma, les enfants, relations et contributions. Collée dans Word, un mail ou Notion, elle garde sa mise en forme et l\'image ; un document joint devient un lien vers le fichier. Dans un éditeur de texte simple, c\'est la version Markdown (adresses des images). Rien n\'est modifié dans SPOK.',
    copySheetDone: 'Fiche copiée',
    print: 'Imprimer : ouvre la fiche dans une fenêtre d\'impression (ou d\'enregistrement en PDF). Rien n\'est modifié dans SPOK.',
    readMode: 'Afficher : l\'élément en lecture, mis en page comme un document (image ou schéma en grand). C\'est exactement ce que copie « Copier la fiche ». Rien ne peut y être modifié.',
    readModeUnsaved: 'Enregistrez d\'abord vos modifications : la lecture montre la version enregistrée.',
    editMode: 'Modifier : la fiche complète, avec tous les champs modifiables.',
    sheetMode: 'Fiche : tous les champs de l\'élément, en lecture seule (vous n\'avez pas le droit de le modifier).',
  },
  zones: {
    'read-media': { title: 'Média', text: 'L\'image ou le schéma de l\'élément en grand ; cliquez pour le plein écran. Pour un document ou un lien : de quoi l\'ouvrir.' },
    'read-content': { title: 'Contenu', text: 'Description, éléments enfants (cliquables), relations et contributions, en lecture seule — le même contenu que celui copié par « Copier la fiche ».' },
  },
  fields: {
    startEnd: 'Début et fin : la période pendant laquelle l\'élément a lieu (barre du Gantt, calendrier).',
    dueDate: 'La date limite à respecter : elle classe l\'élément dans le Planning et le signale en retard une fois dépassée.',
    priority: 'De P1 (urgente) à P4 (basse) : sert au tri et à la vue Priorité.',
    parent: 'L\'élément sous lequel celui-ci se range, dans le même espace : il en devient un sous-élément.',
    assignee: 'La personne chargée de l\'élément : il apparaît dans ses tâches (« Mes tâches », « Ma journée »).',
  },
};

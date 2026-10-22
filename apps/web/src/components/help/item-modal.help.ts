/* Aide utilisateur de la fiche d'un élément (ItemEditModal).
   Lue par le point d'interrogation de l'écran (HelpButton) et le tour (usePageTourPulse) — registre help/pageHelp.ts. */
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
        description: 'Liez cet élément à d\'autres : bloque, dépend de, lié à, duplique, implémente, teste. Ajoutez un commentaire sur chaque relation.',
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
        description: 'Enregistrez, annulez, supprimez, imprimez ou exportez en PDF.',
        side: 'top',
      },
    },
  ],
  fields: {
    startEnd: 'Début et fin : la période pendant laquelle l\'élément a lieu (barre du Gantt, calendrier).',
    dueDate: 'La date limite à respecter : elle classe l\'élément dans le Planning et le signale en retard une fois dépassée.',
    priority: 'De P1 (urgente) à P4 (basse) : sert au tri et à la vue Priorité.',
    parent: 'L\'élément sous lequel celui-ci se range, dans le même espace : il en devient un sous-élément.',
    assignee: 'La personne chargée de l\'élément : il apparaît dans ses tâches (« Mes tâches », « Ma journée »).',
  },
};

/*
 * Tours guidés des pages (tableau de bord, fiche d'item, paramètres de communauté) — déplacés tels quels de
 * hooks/viewTours.ts (2026-10-14). Phase 2 de l'aide intégrée : deviendront des fiches HelpEntry à côté de leur page.
 */
import type { TourStep } from './types';

export const DASHBOARD_TOUR: TourStep[] = [
  {
    popover: {
      title: 'Tableau de bord',
      description: 'Vue d\'ensemble de votre activité : KPIs, tâches prioritaires, calendrier semaine et statistiques par espace.',
    },
  },
  {
    element: '[data-tour="dashboard-kpis"]',
    popover: {
      title: 'Indicateurs clés',
      description: 'En retard, aujourd\'hui, en cours, à valider, terminés cette semaine. Un coup d\'œil suffit pour connaître l\'état de vos tâches.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="org-filters"]',
    popover: {
      title: 'Filtres',
      description: 'Filtrez par espace, communauté, type, statut ou priorité. Combinez les filtres pour cibler exactement ce que vous cherchez.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="org-priorities"]',
    popover: {
      title: 'Priorités & urgences',
      description: 'Trois colonnes : tâches prioritaires, en retard et du jour. Cliquez sur une tâche pour l\'ouvrir directement.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="org-week"]',
    popover: {
      title: 'Calendrier semaine',
      description: 'Visualisez vos tâches jour par jour. Naviguez entre les semaines avec les flèches. Les badges colorés indiquent le statut.',
      side: 'top',
    },
  },
];

// Tour for ItemEditModal
export const ITEM_MODAL_TOUR: TourStep[] = [
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
      description: 'Exprimez votre avis d\'un clic : utile, intéressant, urgent… Cliquez le smiley pour choisir.',
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
];

// Tour for CommunitySettings
export const COMMUNITY_SETTINGS_TOUR: TourStep[] = [
  {
    element: '[data-tour="community-tab-general"]',
    popover: {
      title: 'Général',
      description: 'Nom, description et visibilité (publique/privée) de la communauté. Les tags partagés entre tous les espaces de la communauté.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="community-tab-images"]',
    popover: {
      title: 'Images',
      description: 'Avatar (affiché dans la sidebar et les cartes) et image de couverture. Glissez ou cliquez pour uploader.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="community-tab-spaces"]',
    popover: {
      title: 'Espaces',
      description: 'Liste des espaces de la communauté. Réorganisez la hiérarchie par glisser-déposer. Créez de nouveaux espaces.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="community-tab-members"]',
    popover: {
      title: 'Membres',
      description: '3 colonnes : non-membres → membres → propriétaires. Cliquez les flèches pour déplacer entre colonnes.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="community-tab-emails"]',
    popover: {
      title: 'Emails',
      description: 'Historique des emails envoyés à la communauté. Renvoyez un email aux nouveaux membres ou individuellement.',
      side: 'bottom',
    },
  },
];


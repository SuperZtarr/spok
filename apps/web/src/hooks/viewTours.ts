import type { ViewMode } from '../stores/viewMode';

export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
  };
}

export const VIEW_TOURS: Partial<Record<ViewMode, TourStep[]>> = {
  list: [
    {
      popover: {
        title: 'Vue Liste',
        description: 'Tous vos items en tableau. Triez, filtrez et agissez rapidement sur chaque ligne.',
      },
    },
    {
      element: '[data-tour="list-headers"]',
      popover: {
        title: 'Colonnes triables',
        description: 'Cliquez sur Titre, Type, Statut, Priorité ou Date pour trier. Un second clic inverse l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="list-row"]',
      popover: {
        title: 'Ligne d\'item',
        description: 'Cliquez pour éditer. Survolez pour voir le menu d\'actions (supprimer, déplacer, dupliquer, fusionner…).',
        side: 'bottom',
      },
    },
  ],

  tree: [
    {
      popover: {
        title: 'Vue Arborescence',
        description: 'Visualisez la hiérarchie parent → enfant de vos items avec indentation.',
      },
    },
    {
      element: '[data-tour="tree-expand"]',
      popover: {
        title: 'Déplier / Replier',
        description: 'Cliquez sur le chevron pour voir ou masquer les enfants d\'un item.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="tree-drag"]',
      popover: {
        title: 'Réorganiser',
        description: 'Glissez la poignée pour déplacer un item dans la hiérarchie. Déposez-le sur un autre pour le reparenter.',
        side: 'right',
      },
    },
  ],

  kanban: [
    {
      popover: {
        title: 'Vue Kanban',
        description: 'Vos items en colonnes par statut. Glissez les cartes pour changer leur avancement.',
      },
    },
    {
      element: '[data-tour="kanban-column"]',
      popover: {
        title: 'Colonne de statut',
        description: 'Chaque colonne = un statut. Le compteur indique le nombre d\'items. Glissez une carte ici pour changer son statut.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="kanban-card"]',
      popover: {
        title: 'Carte',
        description: 'Cliquez pour éditer. Survolez pour le menu d\'actions. La priorité et les tags sont visibles directement.',
        side: 'right',
      },
    },
  ],

  types: [
    {
      popover: {
        title: 'Vue Types',
        description: 'Items regroupés par type (Note, Tâche, Projet…). Glissez une carte vers un autre type pour la convertir.',
      },
    },
    {
      element: '[data-tour="types-column"]',
      popover: {
        title: 'Colonnes par type',
        description: 'Chaque colonne représente un type d\'item. Le compteur indique le nombre d\'items. Glissez une carte vers une autre colonne pour changer son type.',
        side: 'bottom',
      },
    },
  ],

  priority: [
    {
      popover: {
        title: 'Vue Priorités',
        description: 'Colonnes P1 (Urgente) à P4 (Basse) + Sans priorité. Glissez pour reprioriser instantanément.',
      },
    },
    {
      element: '[data-tour="priority-column"]',
      popover: {
        title: 'Colonnes de priorité',
        description: 'De P1 (Urgente) à P4 (Basse) puis Sans priorité. Glissez une carte d\'une colonne à l\'autre pour changer sa priorité.',
        side: 'bottom',
      },
    },
  ],

  members: [
    {
      popover: {
        title: 'Vue Membres',
        description: 'Items organisés par assigné. Glissez une carte vers un membre pour la réassigner. La colonne "Non assigné" regroupe les items libres.',
      },
    },
    {
      element: '[data-tour="members-column"]',
      popover: {
        title: 'Colonnes par membre',
        description: 'Chaque colonne = un membre de l\'espace. Glissez une carte vers une colonne pour réassigner l\'item. La colonne "Non assigné" regroupe les items libres.',
        side: 'bottom',
      },
    },
  ],

  mindmap: [
    {
      popover: {
        title: 'Carte mentale',
        description: 'Hiérarchie en étoile radiale. Le nœud central = votre espace. Les branches = vos items.',
      },
    },
    {
      element: '[data-tour="mindmap-node"]',
      popover: {
        title: 'Nœud central',
        description: 'C\'est la racine de votre espace. Les items s\'organisent autour en branches. Les sous-espaces apparaissent comme portails.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="mindmap-controls"]',
      popover: {
        title: 'Navigation',
        description: 'Zoomez avec la molette, déplacez la vue en glissant le fond. Ces boutons permettent de zoomer et recentrer.',
        side: 'left',
      },
    },
  ],

  timeline: [
    {
      popover: {
        title: 'Vue Timeline (Gantt)',
        description: 'Frise chronologique de vos items avec dates. Les barres montrent la durée, les flèches les dépendances.',
      },
    },
    {
      element: '[data-tour="timeline-zoom"]',
      popover: {
        title: 'Échelle temporelle',
        description: 'Changez entre semaine, mois et trimestre. Zoomez avec +/- pour ajuster la granularité.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-bar"]',
      popover: {
        title: 'Barre de durée',
        description: 'Tirez les extrémités pour modifier les dates. Glissez la barre entière pour la décaler. Les flèches montrent les relations.',
        side: 'bottom',
      },
    },
  ],

  planning: [
    {
      popover: {
        title: 'Vue Planning',
        description: 'Vos items avec échéance regroupés par urgence : En retard, Aujourd\'hui, Cette semaine, Ce mois, Plus tard.',
      },
    },
    {
      element: '[data-tour="planning-sections"]',
      popover: {
        title: 'Sections temporelles',
        description: 'Les items sont groupés par urgence : En retard (rouge), Aujourd\'hui (bleu), Cette semaine, Ce mois, Plus tard et Sans date. Cliquez pour éditer.',
        side: 'bottom',
      },
    },
  ],

  calendar: [
    {
      popover: {
        title: 'Vue Calendrier',
        description: 'Calendrier interactif : vue mois, semaine ou liste. Glissez les items pour changer leurs dates.',
      },
    },
    {
      element: '[data-tour="calendar-toolbar"]',
      popover: {
        title: 'Navigation & modes',
        description: 'Basculez entre mois/semaine/liste. Naviguez avec les flèches. Cliquez une date vide pour créer un item.',
        side: 'bottom',
      },
    },
  ],

  text: [
    {
      popover: {
        title: 'Vue Texte',
        description: 'Lecture continue de tous vos items : description complète, contributions et pièces jointes dépliées.',
      },
    },
  ],

  graph: [
    {
      popover: {
        title: 'Vue Graphe',
        description: 'Réseau interactif de vos items. Les liens montrent la hiérarchie et les relations. Cliquez un nœud pour naviguer.',
      },
    },
    {
      element: '[data-tour="graph-scope"]',
      popover: {
        title: 'Portée & filtres',
        description: 'Choisissez : espace seul, communauté entière ou global. Activez/désactivez hiérarchie, relations et tags.',
        side: 'bottom',
      },
    },
  ],

  sunburst: [
    {
      popover: {
        title: 'Vue Sunburst',
        description: 'Cercles concentriques : le centre = espace, chaque anneau = un niveau de hiérarchie. Cliquez pour zoomer dans une branche.',
      },
    },
  ],

  relations: [
    {
      popover: {
        title: 'Vue Relations',
        description: 'Cartographie des liens entre items (bloque, dépend, lié) indépendamment de la hiérarchie parent-enfant.',
      },
    },
    {
      element: '[data-tour="relations-filters"]',
      popover: {
        title: 'Filtres de relations',
        description: 'Activez/désactivez chaque type de relation. Affichez les items isolés (sans relation) si besoin.',
        side: 'bottom',
      },
    },
  ],

  schema: [
    {
      popover: {
        title: 'Vue Schéma',
        description: 'Canvas libre : positionnez vos items où vous voulez. Les positions sont sauvegardées automatiquement.',
      },
    },
    {
      element: '[data-tour="schema-canvas"]',
      popover: {
        title: 'Canvas interactif',
        description: 'Déplacez les nœuds librement. Tirez d\'un point de connexion à un autre pour créer une relation. Double-cliquez pour éditer.',
        side: 'top',
      },
    },
  ],

  bubble: [
    {
      popover: {
        title: 'Vue Bulles',
        description: 'Cercles imbriqués : les parents contiennent leurs enfants. La taille reflète le volume (enfants, contributions ou égale).',
      },
    },
    {
      element: '[data-tour="bubble-size"]',
      popover: {
        title: 'Mode de taille',
        description: 'Choisissez comment dimensionner les bulles : taille égale, par nombre de contributions ou par nombre de relations.',
        side: 'left',
      },
    },
  ],

  radialTree: [
    {
      popover: {
        title: 'Arbre radial',
        description: 'Arborescence en cercle : la racine au centre, les branches rayonnent vers l\'extérieur. Survolez pour voir les détails.',
      },
    },
  ],

  treemap: [
    {
      popover: {
        title: 'Vue Treemap',
        description: 'Rectangles imbriqués : plus un item a d\'enfants ou de contributions, plus il est grand.',
      },
    },
    {
      element: '[data-tour="treemap-mode"]',
      popover: {
        title: 'Mode de taille',
        description: 'Choisissez comment dimensionner : par nombre d\'enfants, de contributions ou en taille égale.',
        side: 'bottom',
      },
    },
  ],

  burndown: [
    {
      popover: {
        title: 'Burndown / Burnup',
        description: 'Suivez la progression dans le temps. Burnup = total + terminés. Burndown = reste à faire avec ligne idéale.',
      },
    },
    {
      element: '[data-tour="burndown-toggle"]',
      popover: {
        title: 'Mode',
        description: 'Basculez entre Burnup (2 courbes montantes) et Burndown (courbe descendante avec objectif en pointillés).',
        side: 'bottom',
      },
    },
  ],

  cfd: [
    {
      popover: {
        title: 'Flux cumulatif (CFD)',
        description: 'Empilage coloré des statuts dans le temps. La largeur de chaque bande = le nombre d\'items dans ce statut. Survolez pour le détail.',
      },
    },
  ],

  chord: [
    {
      popover: {
        title: 'Diagramme Chord',
        description: 'Relations circulaires entre types ou espaces. Les rubans montrent l\'intensité des connexions.',
      },
    },
    {
      element: '[data-tour="chord-mode"]',
      popover: {
        title: 'Regroupement',
        description: 'Par type d\'item ou par espace. Incluez ou excluez les relations hiérarchiques (parent-enfant).',
        side: 'bottom',
      },
    },
  ],

  crossTable: [
    {
      popover: {
        title: 'Tableau croisé',
        description: 'Croisez 2 dimensions pour compter vos items. Cliquez une cellule pour voir les items correspondants.',
      },
    },
    {
      element: '[data-tour="crosstable-dimensions"]',
      popover: {
        title: 'Axes',
        description: 'Choisissez les lignes et colonnes parmi : Type, Statut, Assigné, Espace. Le tableau se met à jour instantanément.',
        side: 'bottom',
      },
    },
  ],

  heatmap: [
    {
      popover: {
        title: 'Heatmap temporelle',
        description: 'Grille d\'activité : chaque case = un jour. Plus c\'est foncé, plus il y a eu de créations ou modifications.',
      },
    },
    {
      element: '[data-tour="heatmap-controls"]',
      popover: {
        title: 'Période & mode',
        description: '6 mois ou 1 an. Créations ou modifications. Survolez une case pour voir le détail du jour.',
        side: 'bottom',
      },
    },
  ],

  ego: [
    {
      popover: {
        title: 'Réseau égocentrique',
        description: 'Explorez le réseau autour d\'un item. Voyez ses connexions directes et indirectes.',
      },
    },
    {
      element: '[data-tour="ego-controls"]',
      popover: {
        title: 'Contrôles',
        description: 'Choisissez l\'item central dans la liste. Ajustez la profondeur (1 à 3 niveaux) pour voir plus ou moins de connexions.',
        side: 'bottom',
      },
    },
  ],
};

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

// Tours for dashboard/global views
import type { DashboardTab } from '../stores/dashboardTab';

export const DASHBOARD_TOURS: Partial<Record<DashboardTab, TourStep[]>> = {
  home: [
    {
      popover: {
        title: 'Accueil',
        description: 'Votre page d\'arrivée. Retrouvez toutes vos communautés et leurs espaces pour naviguer rapidement.',
      },
    },
    {
      element: '[data-tour="home-welcome"]',
      popover: {
        title: 'Bienvenue',
        description: 'Un résumé de votre organisation : nombre de communautés et d\'espaces accessibles.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="home-communities"]',
      popover: {
        title: 'Vos communautés',
        description: 'Cliquez sur une communauté pour la déplier et voir ses espaces. Cliquez sur un espace pour y naviguer directement.',
        side: 'top',
      },
    },
  ],
  communities: [
    {
      popover: {
        title: 'Communautés',
        description: 'Toutes les communautés dont vous êtes membre. Gérez-les ou rejoignez-en de nouvelles.',
      },
    },
    {
      element: '[data-tour="communities-grid"]',
      popover: {
        title: 'Cartes communauté',
        description: 'Chaque carte montre la couverture, le nombre de membres et d\'espaces, et votre rôle. Cliquez pour accéder aux paramètres.',
        side: 'top',
      },
    },
  ],
  spaces: [
    {
      popover: {
        title: 'Espaces',
        description: 'Vue globale de tous vos espaces, groupés par communauté. Créez, organisez et gérez vos espaces de travail.',
      },
    },
  ],
  dashboard: [
    {
      popover: {
        title: 'Dashboard',
        description: 'Votre cockpit personnel. Identifiez en un coup d\'oeil ce qui demande votre attention.',
      },
    },
    {
      element: '[data-tour="dashboard-kpis"]',
      popover: {
        title: 'Indicateurs clés',
        description: 'En retard, aujourd\'hui, en cours, à échéance, à valider, terminés cette semaine. Les compteurs colorés résument votre situation.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="dashboard-panels"]',
      popover: {
        title: 'Détails par urgence',
        description: 'Items en retard (rouge), urgents/prioritaires (orange), en cours (bleu) et à échéance prochaine. Cliquez pour éditer.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="dashboard-week"]',
      popover: {
        title: 'Ma semaine',
        description: 'Planning de la semaine en cours. Naviguez entre les semaines avec les flèches. Chaque jour affiche les items prévus.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="dashboard-progress"]',
      popover: {
        title: 'Progression par espace',
        description: 'Barres d\'avancement : pourcentage d\'items terminés par espace. Vue d\'ensemble de tous vos projets.',
        side: 'left',
      },
    },
  ],
  planning: [
    {
      popover: {
        title: 'Tableau de bord',
        description: 'Organisation personnelle : vos tâches par statut, priorité et échéance à travers tous vos espaces. Utilisez les filtres pour affiner.',
      },
    },
    {
      element: '[data-tour="org-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Filtrez par type, statut, priorité ou espace. Triez par date, priorité ou titre pour retrouver rapidement vos tâches.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="org-priorities"]',
      popover: {
        title: 'Priorités & urgences',
        description: 'Trois panneaux : priorités hautes (P1/P2), items en retard et tâches du jour. Les priorités sont réordonnables par glisser-déposer.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="org-week"]',
      popover: {
        title: 'Vue semaine',
        description: 'Planning hebdomadaire de vos tâches. Naviguez entre les semaines avec les flèches. Chaque jour affiche les items prévus.',
        side: 'top',
      },
    },
  ],
  graph: [
    {
      popover: {
        title: 'Graphe global',
        description: 'Réseau interactif de tous vos items à travers toutes vos communautés.',
      },
    },
    {
      element: '[data-tour="graph-scope"]',
      popover: {
        title: 'Portée & filtres',
        description: 'Basculez entre espace, communauté et global. Activez/désactivez hiérarchie, relations et tags.',
        side: 'bottom',
      },
    },
  ],
  sunburst: [
    {
      popover: {
        title: 'Sunburst global',
        description: 'Cercles concentriques de toute votre organisation. Le centre = SPOK, puis communautés, espaces et items.',
      },
    },
  ],
  mindmap: [
    {
      popover: {
        title: 'Carte mentale globale',
        description: 'Arborescence de toute votre organisation : communautés → espaces → sous-espaces.',
      },
    },
  ],
};

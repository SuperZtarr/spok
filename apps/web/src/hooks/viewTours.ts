import type { ViewMode } from '../stores/viewMode';

export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
  };
}

const toolbarSteps: TourStep[] = [
  {
    element: '[data-tour="toolbar-filters"]',
    popover: {
      title: 'Filtres',
      description: 'Filtrez par type et statut. En mode "Filtre", les items non-correspondants sont masqués. En mode "Lumière", ils sont atténués.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-search"]',
    popover: {
      title: 'Recherche',
      description: 'Recherchez parmi les items de cet espace. Les résultats sont surlignés en jaune.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="toolbar-new-item"]',
    popover: {
      title: 'Nouvel item',
      description: 'Créez un nouvel item dans cet espace (note, tâche, projet, etc.).',
      side: 'bottom',
    },
  },
];

export const VIEW_TOURS: Partial<Record<ViewMode, TourStep[]>> = {
  list: [
    {
      popover: {
        title: 'Vue Liste',
        description: 'Affichez vos items sous forme de tableau triable. Cliquez sur les en-têtes de colonnes pour trier.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="list-headers"]',
      popover: {
        title: 'Colonnes triables',
        description: 'Cliquez sur un en-tête (Titre, Type, Statut, Priorité, Date) pour trier. Cliquez à nouveau pour inverser l\'ordre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="list-row"]',
      popover: {
        title: 'Actions',
        description: 'Survolez une ligne pour voir le menu d\'actions : modifier, supprimer, déplacer, dupliquer, etc.',
        side: 'bottom',
      },
    },
  ],

  tree: [
    {
      popover: {
        title: 'Vue Arborescence',
        description: 'Affichez vos items en hiérarchie parent-enfant. Dépliez les branches pour naviguer dans la structure.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="tree-expand"]',
      popover: {
        title: 'Déplier / Replier',
        description: 'Cliquez sur les chevrons pour déplier ou replier les branches. Utilisez le bouton Étendre/Réduire dans la barre pour tout déplier ou replier.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="tree-drag"]',
      popover: {
        title: 'Glisser-déposer',
        description: 'Glissez un item sur un autre pour le déplacer dans la hiérarchie. Déposez-le sur la zone racine pour le détacher.',
        side: 'right',
      },
    },
  ],

  kanban: [
    {
      popover: {
        title: 'Vue Kanban',
        description: 'Vos items sont organisés en colonnes par statut. Glissez les cartes entre les colonnes pour changer leur statut.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="kanban-column"]',
      popover: {
        title: 'Colonnes de statut',
        description: 'Chaque colonne représente un statut. Le nombre d\'items est affiché dans l\'en-tête.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="kanban-card"]',
      popover: {
        title: 'Cartes',
        description: 'Glissez une carte d\'une colonne à l\'autre pour changer son statut. Cliquez pour éditer. Survolez pour voir le menu d\'actions.',
        side: 'right',
      },
    },
  ],

  types: [
    {
      popover: {
        title: 'Vue Types',
        description: 'Vos items sont regroupés par type (Note, Tâche, Projet, etc.). Glissez les cartes pour changer le type d\'un item.',
      },
    },
    ...toolbarSteps,
  ],

  priority: [
    {
      popover: {
        title: 'Vue Priorités',
        description: 'Vos items sont organisés par priorité : P1 (Urgente) à P4 (Basse). Glissez les cartes pour changer la priorité.',
      },
    },
    ...toolbarSteps,
  ],

  members: [
    {
      popover: {
        title: 'Vue Membres',
        description: 'Vos items sont organisés par membre assigné. Glissez une carte vers un autre membre pour la réassigner.',
      },
    },
    ...toolbarSteps,
  ],

  mindmap: [
    {
      popover: {
        title: 'Carte mentale',
        description: 'Visualisez la hiérarchie de vos items en étoile radiale. Le noeud central représente l\'espace.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="mindmap-controls"]',
      popover: {
        title: 'Contrôles',
        description: 'Zoom, déplacement et recentrage. Utilisez la molette pour zoomer et le clic-glisser pour déplacer la vue.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="mindmap-node"]',
      popover: {
        title: 'Noeuds',
        description: 'Cliquez sur un noeud pour l\'éditer. Utilisez le menu contextuel pour ajouter des enfants, créer des relations ou réorganiser.',
        side: 'bottom',
      },
    },
  ],

  timeline: [
    {
      popover: {
        title: 'Vue Timeline (Gantt)',
        description: 'Visualisez vos items avec dates sur une frise chronologique. Les barres représentent la durée de chaque item.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="timeline-zoom"]',
      popover: {
        title: 'Zoom temporel',
        description: 'Changez l\'échelle : semaine, mois ou trimestre. Utilisez les boutons +/- pour zoomer.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-bar"]',
      popover: {
        title: 'Barres',
        description: 'Redimensionnez une barre par ses extrémités pour modifier les dates. Glissez-la pour la déplacer. Les flèches montrent les relations.',
        side: 'bottom',
      },
    },
  ],

  planning: [
    {
      popover: {
        title: 'Vue Planning',
        description: 'Vos items avec échéance sont regroupés par période : Aujourd\'hui, Cette semaine, Ce mois, Plus tard.',
      },
    },
    ...toolbarSteps,
  ],

  calendar: [
    {
      popover: {
        title: 'Vue Calendrier',
        description: 'Affichez vos items sur un calendrier mensuel, hebdomadaire ou en liste. Glissez pour déplacer ou redimensionner.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="calendar-toolbar"]',
      popover: {
        title: 'Navigation',
        description: 'Basculez entre mois, semaine et liste. Naviguez avec les flèches ou revenez à aujourd\'hui.',
        side: 'bottom',
      },
    },
  ],

  text: [
    {
      popover: {
        title: 'Vue Texte',
        description: 'Affichez le contenu complet de vos items : description, contributions et pièces jointes, le tout en lecture continue.',
      },
    },
    ...toolbarSteps,
  ],

  graph: [
    {
      popover: {
        title: 'Vue Graphe',
        description: 'Visualisez les connexions entre vos items sous forme de réseau interactif. Les noeuds sont liés par les relations et la hiérarchie.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="graph-scope"]',
      popover: {
        title: 'Portée',
        description: 'Choisissez l\'étendue : espace seul, toute la communauté ou global. Filtrez les types de liens affichés.',
        side: 'bottom',
      },
    },
  ],

  sunburst: [
    {
      popover: {
        title: 'Vue Sunburst',
        description: 'Visualisation hiérarchique en cercles concentriques : du centre (espace) vers l\'extérieur (items). Cliquez pour naviguer.',
      },
    },
    ...toolbarSteps,
  ],

  relations: [
    {
      popover: {
        title: 'Vue Relations',
        description: 'Cartographie des relations entre items (bloque, dépend, lié) indépendamment de la hiérarchie parent-enfant.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="relations-filters"]',
      popover: {
        title: 'Filtres de relations',
        description: 'Activez/désactivez les types de relations affichés. Affichez ou masquez les items sans relation.',
        side: 'bottom',
      },
    },
  ],

  schema: [
    {
      popover: {
        title: 'Vue Schéma',
        description: 'Canvas libre pour organiser vos items visuellement. Les positions sont sauvegardées automatiquement.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="schema-canvas"]',
      popover: {
        title: 'Canvas',
        description: 'Déplacez les noeuds librement. Connectez-les en tirant d\'un point de connexion à un autre pour créer des relations. Double-cliquez pour éditer.',
        side: 'top',
      },
    },
  ],

  bubble: [
    {
      popover: {
        title: 'Vue Bulles',
        description: 'Vos items en cercles imbriqués. La taille reflète le nombre d\'enfants, de contributions ou est égale.',
      },
    },
    ...toolbarSteps,
  ],

  radialTree: [
    {
      popover: {
        title: 'Arbre radial',
        description: 'Arborescence en cercle : la racine est au centre, les branches rayonnent vers l\'extérieur.',
      },
    },
    ...toolbarSteps,
  ],

  treemap: [
    {
      popover: {
        title: 'Vue Treemap',
        description: 'Rectangles imbriqués proportionnels au nombre d\'enfants, de contributions ou de taille égale.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="treemap-mode"]',
      popover: {
        title: 'Mode de taille',
        description: 'Choisissez comment dimensionner les rectangles : par nombre d\'enfants, de contributions ou en taille égale.',
        side: 'bottom',
      },
    },
  ],

  burndown: [
    {
      popover: {
        title: 'Vue Burndown / Burnup',
        description: 'Suivez la progression de vos tâches dans le temps. Burnup : courbe du total et des terminés. Burndown : reste à faire avec ligne idéale.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="burndown-toggle"]',
      popover: {
        title: 'Mode',
        description: 'Basculez entre Burnup (2 courbes) et Burndown (décroissant avec ligne idéale en pointillés).',
        side: 'bottom',
      },
    },
  ],

  cfd: [
    {
      popover: {
        title: 'Flux cumulatif (CFD)',
        description: 'Diagramme empilé montrant l\'évolution des statuts dans le temps. Les zones colorées représentent chaque statut.',
      },
    },
    ...toolbarSteps,
  ],

  chord: [
    {
      popover: {
        title: 'Diagramme Chord',
        description: 'Relations circulaires entre types d\'items ou espaces. Les rubans montrent l\'intensité des connexions.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="chord-mode"]',
      popover: {
        title: 'Mode',
        description: 'Basculez entre regroupement par type d\'item ou par espace. Incluez ou excluez les relations hiérarchiques.',
        side: 'bottom',
      },
    },
  ],

  crossTable: [
    {
      popover: {
        title: 'Tableau croisé',
        description: 'Tableau dynamique croisant 2 dimensions (type, statut, assigné, espace). Cliquez sur une cellule pour voir les items correspondants.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="crosstable-dimensions"]',
      popover: {
        title: 'Dimensions',
        description: 'Choisissez les axes lignes et colonnes parmi : Type, Statut, Assigné, Espace.',
        side: 'bottom',
      },
    },
  ],

  heatmap: [
    {
      popover: {
        title: 'Heatmap temporelle',
        description: 'Grille d\'activité type GitHub : chaque case représente un jour. Plus c\'est foncé, plus il y a eu d\'activité.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="heatmap-controls"]',
      popover: {
        title: 'Contrôles',
        description: 'Choisissez la période (6 mois / 1 an) et le mode (créations / modifications). Survolez une case pour voir le détail.',
        side: 'bottom',
      },
    },
  ],

  ego: [
    {
      popover: {
        title: 'Réseau égocentrique',
        description: 'Explorez le réseau autour d\'un item central. Choisissez la profondeur (1 à 3 niveaux) pour voir les connexions.',
      },
    },
    ...toolbarSteps,
    {
      element: '[data-tour="ego-controls"]',
      popover: {
        title: 'Contrôles',
        description: 'Sélectionnez l\'item central, ajustez la profondeur et filtrez par nom.',
        side: 'bottom',
      },
    },
  ],

};

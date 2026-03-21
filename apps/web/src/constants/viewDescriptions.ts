import type { ViewMode } from '../stores/viewMode';

export interface ViewDescription {
  title: string;
  description: string;
  tips: string[];
}

export const VIEW_DESCRIPTIONS: Record<ViewMode, ViewDescription> = {
  list: {
    title: 'Liste',
    description: 'Affichage tabulaire de tous les éléments avec tri et filtrage rapide.',
    tips: [
      'Cliquez sur un en-tête de colonne pour trier',
      'Cliquez sur un élément pour l\'éditer',
      'Glissez-déposez pour réorganiser les éléments',
    ],
  },
  tree: {
    title: 'Arborescence',
    description: 'Vue hiérarchique montrant les relations parent-enfant entre les éléments.',
    tips: [
      'Cliquez sur les flèches pour déplier/replier les branches',
      'Glissez-déposez un élément sur un autre pour le déplacer dans la hiérarchie',
      'Cliquez sur un élément pour l\'éditer',
    ],
  },
  kanban: {
    title: 'Kanban',
    description: 'Tableau de colonnes organisées par statut pour gérer le flux de travail.',
    tips: [
      'Glissez-déposez les cartes entre colonnes pour changer leur statut',
      'Les colonnes correspondent aux statuts définis dans les référentiels',
      'Cliquez sur une carte pour l\'éditer',
    ],
  },
  text: {
    title: 'Texte',
    description: 'Vue document affichant le contenu textuel des éléments de manière continue.',
    tips: [
      'Naviguez dans le contenu comme un document',
      'Cliquez sur un élément pour l\'éditer',
    ],
  },
  planning: {
    title: 'Planning',
    description: 'Vue calendaire par semaines montrant les éléments planifiés avec leurs échéances.',
    tips: [
      'Les éléments sont positionnés selon leurs dates de début et de fin',
      'Cliquez sur un élément pour l\'éditer',
      'Utilisez les flèches pour naviguer entre les semaines',
    ],
  },
  timeline: {
    title: 'Gantt',
    description: 'Diagramme de Gantt montrant les éléments sur une ligne de temps avec leurs dépendances.',
    tips: [
      'Redimensionnez les barres pour ajuster les dates',
      'Glissez les barres horizontalement pour déplacer les dates',
      'Cliquez sur le point central d\'une barre pour créer une relation de dépendance',
      'Les flèches montrent les dépendances entre éléments',
    ],
  },
  calendar: {
    title: 'Calendrier',
    description: 'Vue mensuelle affichant les éléments sur un calendrier classique.',
    tips: [
      'Les éléments apparaissent à leur date d\'échéance',
      'Naviguez entre les mois avec les flèches',
      'Cliquez sur un élément pour l\'éditer',
    ],
  },
  types: {
    title: 'Types',
    description: 'Éléments regroupés par type (note, tâche, projet, etc.) dans des sections distinctes.',
    tips: [
      'Chaque section correspond à un type d\'élément',
      'Cliquez sur un élément pour l\'éditer',
      'Utilisez le filtre de type dans la toolbar pour isoler un type',
    ],
  },
  mindmap: {
    title: 'Carte mentale',
    description: 'Représentation en arbre radial partant du centre, idéale pour le brainstorming.',
    tips: [
      'Zoomez avec la molette de la souris',
      'Glissez le fond pour déplacer la vue',
      'Cliquez sur un nœud pour l\'éditer',
      'La hiérarchie parent-enfant détermine la structure',
    ],
  },
  graph: {
    title: 'Graphe',
    description: 'Réseau interactif montrant les éléments et toutes leurs relations (hiérarchie + liens).',
    tips: [
      'Zoomez avec la molette de la souris',
      'Glissez le fond pour déplacer la vue',
      'Glissez un nœud pour le repositionner',
      'Cliquez sur un nœud pour l\'éditer',
      'Les couleurs représentent les types d\'éléments',
    ],
  },
  sunburst: {
    title: 'Sunburst',
    description: 'Diagramme en cercles concentriques montrant la hiérarchie et les proportions.',
    tips: [
      'Chaque anneau représente un niveau de profondeur',
      'La taille des segments reflète le nombre d\'enfants',
      'Cliquez sur un segment pour l\'éditer',
      'Survolez pour voir les détails',
    ],
  },
  relations: {
    title: 'Relations',
    description: 'Vue focalisée sur les liens entre éléments, montrant le réseau de relations.',
    tips: [
      'Les lignes représentent les relations entre éléments',
      'Zoomez et déplacez la vue pour explorer',
      'Cliquez sur un nœud pour l\'éditer',
    ],
  },
  bubble: {
    title: 'Bulles',
    description: 'Visualisation en bulles dont la taille reflète le nombre d\'enfants ou de relations.',
    tips: [
      'La taille des bulles est proportionnelle au contenu',
      'Les couleurs représentent les types',
      'Cliquez sur une bulle pour l\'éditer',
    ],
  },
  radialTree: {
    title: 'Arbre radial',
    description: 'Arbre hiérarchique disposé en cercle, compact et lisible pour les grandes structures.',
    tips: [
      'La racine est au centre, les feuilles sur les bords',
      'Zoomez pour explorer les branches',
      'Cliquez sur un nœud pour l\'éditer',
    ],
  },
  treemap: {
    title: 'Treemap',
    description: 'Diagramme en rectangles imbriqués montrant la hiérarchie et les proportions relatives.',
    tips: [
      'La surface de chaque rectangle reflète le poids relatif',
      'Les couleurs distinguent les types ou niveaux',
      'Cliquez sur un rectangle pour l\'éditer',
    ],
  },
  chord: {
    title: 'Chord',
    description: 'Diagramme circulaire montrant les relations croisées entre types ou espaces.',
    tips: [
      'Les arcs représentent les groupes (types ou espaces)',
      'Les rubans montrent les relations entre groupes',
      'Survolez un arc ou un ruban pour voir les détails',
    ],
  },
  burndown: {
    title: 'Burndown',
    description: 'Graphique montrant la progression des tâches terminées dans le temps.',
    tips: [
      'La ligne descend au fur et à mesure que les tâches sont terminées',
      'Comparez avec la ligne idéale pour évaluer le rythme',
      'Sélectionnez la période à afficher',
    ],
  },
  cfd: {
    title: 'Flux cumulatif',
    description: 'Diagramme de flux cumulatif (CFD) montrant l\'évolution des statuts dans le temps.',
    tips: [
      'Chaque bande colorée représente un statut',
      'L\'épaisseur d\'une bande montre le nombre d\'éléments dans ce statut',
      'Un rétrécissement indique un goulot d\'étranglement',
    ],
  },
  crossTable: {
    title: 'Tableau croisé',
    description: 'Tableau croisé dynamique montrant les éléments selon deux dimensions au choix.',
    tips: [
      'Sélectionnez les axes (lignes et colonnes) dans les menus',
      'Les cellules montrent le nombre d\'éléments correspondants',
      'Cliquez sur une cellule pour voir les éléments',
    ],
  },
  ego: {
    title: 'Réseau égocentrique',
    description: 'Graphe centré sur un item montrant ses voisins directs et indirects par anneaux concentriques.',
    tips: [
      'Sélectionnez l\'item central dans le menu déroulant ou cliquez sur un nœud',
      'Ajustez la profondeur (1 à 3 niveaux) avec le slider',
      'Cliquez sur un nœud pour recentrer le réseau sur cet item',
      'Double-cliquez pour éditer l\'item',
      'Les relations et la hiérarchie parent-enfant sont toutes deux affichées',
    ],
  },
  heatmap: {
    title: 'Heatmap',
    description: 'Carte de chaleur type GitHub montrant l\'activité quotidienne sur 6 mois ou 1 an.',
    tips: [
      'Chaque case représente un jour, la couleur indique l\'intensité',
      'Basculez entre créations et modifications',
      'Survolez une case pour voir les détails du jour',
      'Cliquez sur une case avec un seul élément pour l\'éditer',
    ],
  },
  priority: {
    title: 'Priorités',
    description: 'Kanban par niveau de priorité. Glissez-déposez les items pour changer leur priorité.',
    tips: [
      'Colonnes P1 (Urgente) à P4 (Basse) + Sans priorité',
      'Glissez un item vers une colonne pour changer sa priorité',
    ],
  },
  members: {
    title: 'Membres',
    description: 'Kanban par membre de l\'espace. Glissez-déposez les items pour les assigner.',
    tips: [
      'Chaque colonne représente un membre de l\'espace',
      'Glissez un item vers une colonne pour l\'assigner à ce membre',
      'La colonne "Non assigné" regroupe les items sans responsable',
    ],
  },
  links: {
    title: 'Liens',
    description: 'Affichage des items de type LINK sous forme d\'etiquettes avec favicon et metadonnees.',
    tips: [
      'Cliquez sur un lien pour l\'ouvrir dans un nouvel onglet',
      'Double-cliquez pour editer l\'item',
      'Le favicon et le titre sont recuperes automatiquement',
    ],
  },
  documents: {
    title: 'Documents',
    description: 'Liste des documents attaches a l\'espace avec apercu du type de fichier.',
    tips: [
      'Cliquez sur un document pour l\'editer',
      'Le bouton de telechargement apparait au survol',
      'Le type de fichier est indique par l\'icone et l\'extension',
    ],
  },
  images: {
    title: 'Images',
    description: 'Galerie d\'images de l\'espace. Cliquez pour agrandir, double-cliquez pour editer.',
    tips: [
      'Cliquez sur une image pour l\'ouvrir en plein ecran',
      'Utilisez les fleches gauche/droite pour naviguer',
      'Double-cliquez pour editer l\'item',
      'Appuyez sur Echap pour fermer',
    ],
  },
};

import type { DashboardTab } from '../stores/dashboardTab';

export const DASHBOARD_DESCRIPTIONS: Record<DashboardTab, ViewDescription> = {
  home: {
    title: 'Accueil',
    description: 'Page de navigation rapide vers vos communautés et espaces.',
    tips: [
      'Cliquez sur une communauté pour la déplier',
      'Cliquez sur un espace pour y accéder directement',
      'Les espaces personnels sont listés séparément',
    ],
  },
  communities: {
    title: 'Communautés',
    description: 'Toutes les communautés dont vous êtes membre.',
    tips: [
      'Cliquez sur une carte pour accéder à la communauté',
      'Créez une nouvelle communauté avec le bouton en haut',
      'Les communautés publiques sont visibles par tous',
    ],
  },
  spaces: {
    title: 'Espaces',
    description: 'Vue globale de tous vos espaces, groupés par communauté.',
    tips: [
      'Créez de nouveaux espaces avec le bouton "Nouvel espace"',
      'Glissez-déposez pour réorganiser la hiérarchie des espaces',
      'Cliquez sur un espace pour y accéder',
    ],
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Cockpit personnel avec KPIs, items urgents et progression.',
    tips: [
      'Les items en retard sont en rouge',
      'La grille semaine montre votre planning',
      'Les barres de progression montrent l\'avancement par espace',
    ],
  },
  planning: {
    title: 'Tableau de bord',
    description: 'Organisation personnelle de vos tâches à travers tous les espaces.',
    tips: [
      'Filtrez par type, statut, priorité ou échéance',
      'Cliquez sur un item pour l\'éditer',
      'Les filtres sont persistés entre les sessions',
    ],
  },
  graph: {
    title: 'Graphe global',
    description: 'Réseau interactif de tous vos items à travers les communautés.',
    tips: [
      'Cliquez sur un nœud pour naviguer vers l\'item',
      'Utilisez les filtres pour afficher/masquer hiérarchie, relations et tags',
      'Zoomez avec la molette, déplacez avec le clic-glisser',
    ],
  },
  sunburst: {
    title: 'Sunburst global',
    description: 'Hiérarchie en cercles concentriques de toutes vos communautés et espaces.',
    tips: [
      'Cliquez sur un segment pour zoomer dans cette branche',
      'Survolez pour voir les détails',
      'Les couleurs indiquent le type d\'élément',
    ],
  },
  mindmap: {
    title: 'Carte mentale globale',
    description: 'Arborescence de toute votre organisation : communautés → espaces.',
    tips: [
      'Cliquez sur un espace pour y naviguer',
      'Glissez pour réorganiser',
      'Utilisez les contrôles pour zoomer et recentrer',
    ],
  },
};

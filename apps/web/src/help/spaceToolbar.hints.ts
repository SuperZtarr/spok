/* Infobulles de la barre d'outils d'un espace (SpaceToolbar : #global-toolbar), lues par HelpHint — y compris les
   commandes rendues par des composants partagés de la barre : Séances (ParentSessionsButton) et Exporter
   (ExportDropdownButton, en-tête de chaque vue). Textes d'aide utilisateur : à modifier ici (avec Thomas), pas dans
   les composants. Une clé par commande. */
export const SPACE_TOOLBAR_HINTS = {
  orderManual: 'Ordre manuel : celui que vous avez fixé en glissant les éléments.',
  orderAlphaFlat: 'Tri alphabétique de tous les éléments, sans tenir compte des parents.',
  orderAlphaTree: 'Tri alphabétique à l\'intérieur de chaque parent : l\'arborescence est conservée.',
  filter: 'Filtre : masque les éléments qui ne correspondent pas (type, statut, texte). Le compteur à droite indique combien restent.',
  filterType: 'N\'afficher qu\'un type d\'élément.',
  filterStatus: 'N\'afficher qu\'un statut.',
  highlight: 'Aperçu : met en évidence les éléments qui correspondent et estompe les autres, sans rien masquer.',
  highlightType: 'Mettre en évidence un type d\'élément.',
  highlightStatus: 'Mettre en évidence un statut.',
  clearSearch: 'Effacer la recherche',
  count: 'Nombre d\'éléments affichés / nombre total dans l\'espace.',
  mobileFilters: 'Afficher les filtres et l\'aperçu',
  insertTemplate: 'Insérer un modèle : ajoute d\'un coup un ensemble d\'éléments enregistré comme modèle.',
  history: 'Historique : toutes les modifications de l\'espace, avec restauration possible.',
  settings: 'Paramètres de l\'espace : nom, visibilité, membres, vue par défaut…',
  expandAll: 'Tout étendre : déplie toutes les branches d\'un coup.',
  collapseAll: 'Tout réduire : replie toutes les branches, seuls les éléments de premier niveau restent visibles.',
  newItem: 'Nouveau : crée un élément dans cet espace ; sa fiche s\'ouvre pour le compléter.',
  sessions: 'Séances : présenter des éléments en direct à d\'autres membres — rejoindre la séance en cours ou en préparer une.',
  dismissImport: 'Fermer le bilan de l\'import',
  export:'Exporter : télécharger le contenu de la vue (formats selon la vue : CSV, Excel, PDF, image…).',
  otherViews: 'D\'autres façons de voir le même contenu.',
  defaultView: 'vue par défaut de l\'espace',
} satisfies Record<string, string>;

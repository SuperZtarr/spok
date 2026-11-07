/* Infobulles de la barre d'outils d'un espace (SpaceToolbar : #global-toolbar), lues par HelpHint — y compris les
   commandes rendues par des composants partagés de la barre : Séances (ParentSessionsButton) et Exporter
   (ExportDropdownButton, en-tête de chaque vue). Textes d'aide utilisateur : à modifier ici (avec Thomas), pas dans
   les composants. Une clé par commande. Les commandes principales reprennent le texte court de leur élément
   (spaceToolbar.elements.ts) ; ici ne s'écrivent que les détails propres au survol (options d'un menu, effacer…). */
import { SPACE_TOOLBAR_ELEMENTS as E } from './spaceToolbar.elements';

export const SPACE_TOOLBAR_HINTS = {
  orderManual: 'Ordre manuel : celui que vous avez fixé en glissant les éléments.',
  orderAlphaFlat: 'Tri alphabétique de tous les éléments, sans tenir compte des parents.',
  orderAlphaTree: 'Tri alphabétique à l\'intérieur de chaque parent : l\'arborescence est conservée.',
  filter: E.filtre.short,
  filterType: 'N\'afficher que les types cochés. Vous pouvez en cocher plusieurs.',
  filterStatus: 'N\'afficher que les statuts cochés. Vous pouvez en cocher plusieurs.',
  highlight: E.apercu.short,
  highlightType: 'Mettre en évidence les types cochés. Vous pouvez en cocher plusieurs.',
  highlightStatus: 'Mettre en évidence les statuts cochés. Vous pouvez en cocher plusieurs.',
  clearSearch: 'Effacer la recherche',
  clearFilters: 'Effacer le filtre : retire les types, les statuts et le texte recherché. Tous les éléments réapparaissent.',
  clearHighlight: 'Effacer l\'aperçu : retire les types, les statuts et le texte recherché. Plus aucun élément n\'est estompé.',
  count: E.compteur.short,
  mobileFilters: 'Afficher le filtre ou l\'aperçu de la vue',
  insertTemplate: E.modele.short,
  history: E.historique.short,
  settings: E.parametres.short,
  expandAll: 'Tout étendre : déplie toutes les branches d\'un coup.',
  collapseAll: 'Tout réduire : replie toutes les branches, seuls les éléments de premier niveau restent visibles.',
  newItem: E.nouveau.short,
  sessions: E.seances.short,
  dismissImport: 'Fermer le bilan de l\'import',
  export: E.exporter.short,
  otherViews: E.vues.short,
  defaultView: 'vue par défaut de l\'espace',
} satisfies Record<string, string>;

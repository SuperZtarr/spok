import type { ViewConfigItem, ViewCategoryConfig, GlobalPageConfig, GlobalPageGroupConfig } from '../types/viewConfig.js';

export const DEFAULT_VIEW_CATEGORIES: ViewCategoryConfig[] = [
  { id: 'dashboard', label: 'Tableau de bord', order: 0 },
  { id: 'basic', label: 'Basique', order: 1 },
  { id: 'planning', label: 'Planification', order: 2 },
  { id: 'exploration', label: 'Exploration', order: 3 },
];

export const DEFAULT_VIEW_CONFIG: ViewConfigItem[] = [
  { id: 'list', label: 'Liste', icon: 'List', category: 'basic', order: 0, visible: true, access: 'public' },
  { id: 'tree', label: 'Arborescence', icon: 'GitBranch', category: 'basic', order: 1, visible: true, access: 'public' },
  { id: 'kanban', label: 'Kanban', icon: 'Columns3', category: 'planning', order: 2, visible: true, access: 'public' },
  { id: 'text', label: 'Texte', icon: 'FileText', category: 'basic', order: 3, visible: true, access: 'public' },
  { id: 'planning', label: 'Planning', icon: 'CalendarCheck', category: 'planning', order: 4, visible: true, access: 'user' },
  { id: 'timeline', label: 'Gantt', icon: 'GanttChart', category: 'planning', order: 5, visible: true, access: 'user' },
  { id: 'calendar', label: 'Calendrier', icon: 'Calendar', category: 'planning', order: 6, visible: true, access: 'user' },
  { id: 'types', label: 'Types', icon: 'LayoutGrid', category: 'basic', order: 7, visible: true, access: 'public' },
  { id: 'mindmap', label: 'Carte mentale', icon: 'Share2', category: 'exploration', order: 8, visible: true, access: 'public' },
  { id: 'graph', label: 'Graphe', icon: 'Network', category: 'exploration', order: 9, visible: true, access: 'user' },
  { id: 'sunburst', label: 'Sunburst', icon: 'CircleDot', category: 'exploration', order: 10, visible: true, access: 'user' },
  { id: 'relations', label: 'Relations', icon: 'Waypoints', category: 'exploration', order: 11, visible: true, access: 'user' },
  { id: 'bubble', label: 'Bulles', icon: 'Circle', category: 'exploration', order: 12, visible: true, access: 'user' },
  { id: 'radialTree', label: 'Arbre radial', icon: 'Orbit', category: 'exploration', order: 13, visible: true, access: 'user' },
  { id: 'treemap', label: 'Treemap', icon: 'SquareStack', category: 'exploration', order: 14, visible: true, access: 'user' },
  { id: 'chord', label: 'Chord', icon: 'Disc', category: 'exploration', order: 15, visible: true, access: 'user' },
  { id: 'burndown', label: 'Burndown', icon: 'TrendingDown', category: 'planning', order: 16, visible: true, access: 'user' },
  { id: 'cfd', label: 'Flux cumulatif', icon: 'Layers', category: 'planning', order: 17, visible: true, access: 'user' },
  { id: 'members', label: 'Membres', icon: 'Users', category: 'basic', order: 18, visible: true, access: 'user' },
  { id: 'priority', label: 'Priorités', icon: 'Flame', category: 'basic', order: 19, visible: true, access: 'user' },
  { id: 'crossTable', label: 'Tableau croisé', icon: 'Table2', category: 'basic', order: 20, visible: true, access: 'user' },
  { id: 'heatmap', label: 'Heatmap', icon: 'Grid3x3', category: 'exploration', order: 21, visible: true, access: 'user' },
  { id: 'ego', label: 'Réseau ego', icon: 'Focus', category: 'exploration', order: 22, visible: true, access: 'user' },
];

export const DEFAULT_GLOBAL_PAGE_GROUPS: GlobalPageGroupConfig[] = [
  { id: 'global', label: 'Vues globales', order: 0 },
  { id: 'myActivities', label: 'Mes activités', order: 1 },
  { id: 'misc', label: 'Divers', order: 2 },
];

export const DEFAULT_GLOBAL_PAGES: GlobalPageConfig[] = [
  { id: 'home', label: 'Accueil', icon: 'Home', group: 'global', order: 0, visible: true, access: 'user' },
  { id: 'communities', label: 'Communautés', icon: 'Users', group: 'global', order: 1, visible: true, access: 'user' },
  { id: 'spaces', label: 'Espaces', icon: 'FolderKanban', group: 'global', order: 2, visible: true, access: 'user' },
  { id: 'sunburst', label: 'Sunburst', icon: 'CircleDot', group: 'global', order: 3, visible: true, access: 'user' },
  { id: 'mindmap', label: 'Carte mentale', icon: 'GitBranch', group: 'global', order: 4, visible: true, access: 'user' },
  { id: 'graph', label: 'Graphe global', icon: 'Network', group: 'global', order: 5, visible: true, access: 'user' },
  { id: 'planning', label: 'Tableau de bord', icon: 'LayoutDashboard', group: 'myActivities', order: 6, visible: true, access: 'user' },
  { id: 'search', label: 'Recherche', icon: 'Search', group: 'misc', order: 100, visible: true, access: 'user' },
  { id: 'profile', label: 'Profil', icon: 'User', group: 'misc', order: 101, visible: true, access: 'user' },
  { id: 'sitemap', label: 'Plan du site', icon: 'MapIcon', group: 'misc', order: 102, visible: true, access: 'public' },
  { id: 'logout', label: 'Deconnexion', icon: 'LogOut', group: 'misc', order: 103, visible: true, access: 'user' },
];

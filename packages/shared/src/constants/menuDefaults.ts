import type { MenuItemConfig } from '../types/menuItem.js';

export const DEFAULT_MENU_ITEMS: MenuItemConfig[] = [
  // ── Section: global (Vues globales) ──
  { id: '', key: 'home', label: 'Accueil', icon: 'Home', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/', viewMode: null, order: 0, visible: true, access: 'user' },
  { id: '', key: 'communities', label: 'Communautés', icon: 'Users', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/communities', viewMode: null, order: 1, visible: true, access: 'user' },
  { id: '', key: 'spaces', label: 'Espaces', icon: 'FolderKanban', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/spaces', viewMode: null, order: 2, visible: true, access: 'user' },
  { id: '', key: 'global-sunburst', label: 'Sunburst', icon: 'CircleDot', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/sunburst', viewMode: null, order: 3, visible: true, access: 'user' },
  { id: '', key: 'global-mindmap', label: 'Carte mentale', icon: 'GitBranch', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/mindmap', viewMode: null, order: 4, visible: true, access: 'user' },
  { id: '', key: 'global-graph', label: 'Graphe global', icon: 'Network', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/graph', viewMode: null, order: 5, visible: true, access: 'user' },
  { id: '', key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', section: 'global', sectionLabel: 'Vues globales', sectionOrder: 0, route: '/dashboard', viewMode: null, order: 6, visible: true, access: 'user' },

  // ── Section: basic (Basique) ──
  { id: '', key: 'list', label: 'Liste', icon: 'List', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'list', order: 0, visible: true, access: 'public' },
  { id: '', key: 'tree', label: 'Arborescence', icon: 'GitBranch', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'tree', order: 1, visible: true, access: 'public' },
  { id: '', key: 'text', label: 'Texte', icon: 'FileText', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'text', order: 2, visible: true, access: 'public' },
  { id: '', key: 'types', label: 'Types', icon: 'LayoutGrid', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'types', order: 3, visible: true, access: 'public' },
  { id: '', key: 'members', label: 'Membres', icon: 'Users', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'members', order: 4, visible: true, access: 'user' },
  { id: '', key: 'priority', label: 'Priorités', icon: 'Flame', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'priority', order: 5, visible: true, access: 'user' },
  { id: '', key: 'crossTable', label: 'Tableau croisé', icon: 'Table2', section: 'basic', sectionLabel: 'Basique', sectionOrder: 1, route: null, viewMode: 'crossTable', order: 6, visible: true, access: 'user' },

  // ── Section: planning (Planification) ──
  { id: '', key: 'kanban', label: 'Kanban', icon: 'Columns3', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'kanban', order: 0, visible: true, access: 'public' },
  { id: '', key: 'planning', label: 'Planning', icon: 'CalendarCheck', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'planning', order: 1, visible: true, access: 'user' },
  { id: '', key: 'timeline', label: 'Gantt', icon: 'GanttChart', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'timeline', order: 2, visible: true, access: 'user' },
  { id: '', key: 'calendar', label: 'Calendrier', icon: 'Calendar', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'calendar', order: 3, visible: true, access: 'user' },
  { id: '', key: 'burndown', label: 'Burndown', icon: 'TrendingDown', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'burndown', order: 4, visible: true, access: 'user' },
  { id: '', key: 'cfd', label: 'Flux cumulatif', icon: 'Layers', section: 'planning', sectionLabel: 'Planification', sectionOrder: 2, route: null, viewMode: 'cfd', order: 5, visible: true, access: 'user' },

  // ── Section: exploration (Exploration) ──
  { id: '', key: 'mindmap', label: 'Carte mentale', icon: 'Share2', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'mindmap', order: 0, visible: true, access: 'public' },
  { id: '', key: 'graph', label: 'Graphe', icon: 'Network', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'graph', order: 1, visible: true, access: 'user' },
  { id: '', key: 'sunburst', label: 'Sunburst', icon: 'CircleDot', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'sunburst', order: 2, visible: true, access: 'user' },
  { id: '', key: 'relations', label: 'Relations', icon: 'Waypoints', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'relations', order: 3, visible: true, access: 'user' },
  { id: '', key: 'bubble', label: 'Bulles', icon: 'Circle', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'bubble', order: 4, visible: true, access: 'user' },
  { id: '', key: 'radialTree', label: 'Arbre radial', icon: 'Orbit', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'radialTree', order: 5, visible: true, access: 'user' },
  { id: '', key: 'treemap', label: 'Treemap', icon: 'SquareStack', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'treemap', order: 6, visible: true, access: 'user' },
  { id: '', key: 'chord', label: 'Chord', icon: 'Disc', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'chord', order: 7, visible: true, access: 'user' },
  { id: '', key: 'heatmap', label: 'Heatmap', icon: 'Grid3x3', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'heatmap', order: 8, visible: true, access: 'user' },
  { id: '', key: 'ego', label: 'Réseau ego', icon: 'Focus', section: 'exploration', sectionLabel: 'Exploration', sectionOrder: 3, route: null, viewMode: 'ego', order: 9, visible: true, access: 'user' },

  // ── Section: admin (Administration) ──
  { id: '', key: 'admin-communities', label: 'Communautés', icon: 'Building2', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/communities', viewMode: null, order: 0, visible: true, access: 'admin' },
  { id: '', key: 'admin-spaces', label: 'Espaces', icon: 'FolderKanban', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/spaces', viewMode: null, order: 1, visible: true, access: 'admin' },
  { id: '', key: 'admin-users', label: 'Utilisateurs', icon: 'Users', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/users', viewMode: null, order: 2, visible: true, access: 'admin' },
  { id: '', key: 'admin-stats', label: 'Statistiques', icon: 'BarChart3', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/stats', viewMode: null, order: 3, visible: true, access: 'admin' },
  { id: '', key: 'admin-audit', label: 'Audit', icon: 'History', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/audit-logs', viewMode: null, order: 4, visible: true, access: 'admin' },
  { id: '', key: 'admin-anomalies', label: 'Diagnostics', icon: 'AlertTriangle', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/anomalies', viewMode: null, order: 5, visible: true, access: 'admin' },
  { id: '', key: 'admin-menu', label: 'Menus', icon: 'Settings', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/menu', viewMode: null, order: 6, visible: true, access: 'admin' },
  { id: '', key: 'admin-referentiels', label: 'Référentiels', icon: 'Settings', section: 'admin', sectionLabel: 'Administration', sectionOrder: 4, route: '/admin/referentiels', viewMode: null, order: 7, visible: true, access: 'admin' },

  // ── Section: misc (Divers) ──
  { id: '', key: 'search', label: 'Recherche', icon: 'Search', section: 'misc', sectionLabel: 'Divers', sectionOrder: 5, route: '/search', viewMode: null, order: 0, visible: true, access: 'user' },
  { id: '', key: 'profile', label: 'Profil', icon: 'User', section: 'misc', sectionLabel: 'Divers', sectionOrder: 5, route: null, viewMode: null, order: 1, visible: true, access: 'user' },
  { id: '', key: 'sitemap', label: 'Plan du site', icon: 'MapIcon', section: 'misc', sectionLabel: 'Divers', sectionOrder: 5, route: '/sitemap', viewMode: null, order: 2, visible: true, access: 'public' },
  { id: '', key: 'logout', label: 'Déconnexion', icon: 'LogOut', section: 'misc', sectionLabel: 'Divers', sectionOrder: 5, route: null, viewMode: null, order: 3, visible: true, access: 'user' },
];

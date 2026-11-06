/*
 * Registre central des vues d'espace (id, libellé, icône, catégorie, ordre, niveau d'accès, masquage mobile).
 * Source unique : toute liste de vues se dérive d'ici (MOBILE_HIDDEN_VIEWS, catégories…), jamais de copie dans une page.
 * `access` contrôle la visibilité via useMenuItems (public < user < admin) — ne pas confondre avec
 * les modes d'interface (forum/projet/exploration, cf. stores/interfaceMode.ts) qui filtrent en plus
 * les vues déjà accessibles selon le contexte d'usage courant.
 * Un visiteur non connecté a les mêmes vues qu'un connecté (décision Thomas 2026-11-06) : seul 'admin' reste réservé.
 * Surcharges possibles dans /admin/views (AppConfig menu_overrides), qui priment sur ce registre.
 * `mobileHidden` : bouton de vue masqué sous 640 px dans les barres de vues (SpaceToolbar, ViewSelectorBar).
 */
export interface ViewDefinition {
  id: string;
  label: string;
  icon: string;
  category: 'basic' | 'itemTypes' | 'planning' | 'exploration';
  order: number; // within-category
  visible: boolean;
  access: 'public' | 'user' | 'admin';
  mobileHidden?: boolean;
}

export const VIEW_REGISTRY: ViewDefinition[] = [
  // ── basic ──
    { id: 'list',       label: 'Liste',          icon: 'List',         category: 'basic',     order: 0, visible: true, access: 'public' },
    { id: 'thread',     label: 'Discussions',    icon: 'MessageSquare',category: 'basic',     order: 2, visible: true, access: 'public'   },
    { id: 'text',       label: 'Texte',          icon: 'FileText',     category: 'basic',     order: 3, visible: true, access: 'public' },
    { id: 'tree',       label: 'Arborescence',   icon: 'GitBranch',    category: 'basic',     order: 4, visible: true, access: 'public' },
  { id: 'members',    label: 'Assignations',        icon: 'Users',        category: 'basic',     order: 5, visible: true, access: 'admin', mobileHidden: true },
  { id: 'crossTable', label: 'Tableau croisé', icon: 'Table2',       category: 'basic',     order: 6, visible: true, access: 'admin', mobileHidden: true },
    { id: 'recent',     label: 'Récents',        icon: 'Clock',        category: 'basic',     order: 7, visible: true, access: 'public'   },

  // ── itemTypes ──
  { id: 'types',      label: 'Types',          icon: 'LayoutGrid',   category: 'itemTypes',     order: 0, visible: true, access: 'public', mobileHidden: true },
  { id: 'links',     label: 'Liens',      icon: 'ExternalLink', category: 'itemTypes', order: 1, visible: true, access: 'public' },
  { id: 'images',    label: 'Images',     icon: 'Image',        category: 'itemTypes', order: 2, visible: true, access: 'public' },
  { id: 'documents', label: 'Documents',  icon: 'FileText',     category: 'itemTypes', order: 3, visible: true, access: 'public'   },
  { id: 'articles',  label: 'Articles',   icon: 'Newspaper',    category: 'itemTypes', order: 4, visible: true, access: 'public'   },
  { id: 'bugs',      label: 'Bugs',       icon: 'Bug',          category: 'itemTypes', order: 5, visible: true, access: 'public'   },
  { id: 'todo',      label: 'Todo',       icon: 'CheckSquare',  category: 'itemTypes', order: 6, visible: true, access: 'public'   },

  // ── planning ──
  { id: 'kanban',   label: 'Kanban',         icon: 'Columns3',    category: 'planning', order: 0, visible: true, access: 'public', mobileHidden: true },
  { id: 'timeline', label: 'Gantt',          icon: 'GanttChart',  category: 'planning', order: 1, visible: true, access: 'public', mobileHidden: true },
  { id: 'pert',     label: 'PERT',           icon: 'GitMerge',    category: 'planning', order: 2, visible: true, access: 'public'   },
  { id: 'calendar', label: 'Calendrier',     icon: 'Calendar',    category: 'planning', order: 3, visible: true, access: 'public' },
  { id: 'planning', label: 'Planning',       icon: 'CalendarCheck',category: 'planning', order: 4, visible: true, access: 'public', mobileHidden: true },
  { id: 'burndown', label: 'Burndown',       icon: 'TrendingDown',category: 'planning', order: 5, visible: true, access: 'admin', mobileHidden: true },
  { id: 'cfd',      label: 'Flux cumulatif', icon: 'Layers',      category: 'planning', order: 6, visible: true, access: 'admin', mobileHidden: true },
  { id: 'priority', label: 'Priorités',      icon: 'Flame',       category: 'planning', order: 7, visible: true, access: 'public'   },
  { id: 'process',  label: 'Process',        icon: 'Workflow',    category: 'planning', order: 8, visible: true, access: 'public', mobileHidden: true },

  // ── exploration ──
  { id: 'mindmap',    label: 'Carte mentale', icon: 'Share2',     category: 'exploration', order: 0, visible: true, access: 'public' },
  { id: 'graph',      label: 'Graphe',        icon: 'Network',    category: 'exploration', order: 1, visible: true, access: 'public', mobileHidden: true },
  { id: 'sunburst',   label: 'Sunburst',      icon: 'CircleDot',  category: 'exploration', order: 2, visible: true, access: 'admin', mobileHidden: true },
  { id: 'relations',  label: 'Relations',     icon: 'Waypoints',  category: 'exploration', order: 3, visible: true, access: 'admin', mobileHidden: true },
  { id: 'bubble',     label: 'Bulles',        icon: 'Circle',     category: 'exploration', order: 4, visible: true, access: 'admin', mobileHidden: true },
  { id: 'radialTree', label: 'Arbre radial',  icon: 'Orbit',      category: 'exploration', order: 5, visible: true, access: 'admin', mobileHidden: true },
  { id: 'treemap',    label: 'Treemap',       icon: 'SquareStack',category: 'exploration', order: 6, visible: true, access: 'public', mobileHidden: true },
  { id: 'chord',      label: 'Chord',         icon: 'Disc',       category: 'exploration', order: 7, visible: true, access: 'admin', mobileHidden: true },
  { id: 'heatmap',    label: 'Heatmap',       icon: 'Grid3x3',    category: 'exploration', order: 8, visible: true, access: 'admin', mobileHidden: true },
  { id: 'ego',        label: 'Réseau ego',    icon: 'Focus',      category: 'exploration', order: 9, visible: true, access: 'admin', mobileHidden: true },
  { id: 'loupe',      label: 'Loupe',         icon: 'ZoomIn',     category: 'exploration', order: 10, visible: true, access: 'public', mobileHidden: true },
];

/** Vues dont le bouton est masqué sur mobile, dérivées du registre. */
export const MOBILE_HIDDEN_VIEWS: ReadonlySet<string> = new Set(VIEW_REGISTRY.filter((v) => v.mobileHidden).map((v) => v.id));

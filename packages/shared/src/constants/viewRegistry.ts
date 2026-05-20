export interface ViewDefinition {
  id: string;
  label: string;
  icon: string;
  category: 'basic' | 'itemTypes' | 'planning' | 'exploration';
  order: number; // within-category
  visible: boolean;
  access: 'public' | 'user' | 'admin';
}

export const VIEW_REGISTRY: ViewDefinition[] = [
  // ── basic ──
  { id: 'list',       label: 'Liste',          icon: 'List',         category: 'basic',     order: 0, visible: true, access: 'public' },
  { id: 'tree',       label: 'Arborescence',   icon: 'GitBranch',    category: 'basic',     order: 1, visible: true, access: 'public' },
  { id: 'text',       label: 'Texte',          icon: 'FileText',     category: 'basic',     order: 2, visible: true, access: 'public' },
  { id: 'types',      label: 'Types',          icon: 'LayoutGrid',   category: 'basic',     order: 3, visible: true, access: 'public' },
  { id: 'members',    label: 'Membres',        icon: 'Users',        category: 'basic',     order: 4, visible: true, access: 'user'   },
  { id: 'thread',     label: 'Discussions',    icon: 'MessageSquare',category: 'basic',     order: 5, visible: true, access: 'user'   },
  { id: 'crossTable', label: 'Tableau croisé', icon: 'Table2',       category: 'basic',     order: 6, visible: true, access: 'user'   },
  { id: 'recent',     label: 'Récents',        icon: 'Clock',        category: 'basic',     order: 7, visible: true, access: 'user'   },

  // ── itemTypes ──
  { id: 'links',     label: 'Liens',      icon: 'ExternalLink', category: 'itemTypes', order: 0, visible: true, access: 'public' },
  { id: 'images',    label: 'Images',     icon: 'Image',        category: 'itemTypes', order: 1, visible: true, access: 'public' },
  { id: 'documents', label: 'Documents',  icon: 'FileText',     category: 'itemTypes', order: 2, visible: true, access: 'user'   },
  { id: 'bugs',      label: 'Bugs',       icon: 'Bug',          category: 'itemTypes', order: 3, visible: true, access: 'user'   },
  { id: 'todo',      label: 'Todo',       icon: 'CheckSquare',  category: 'itemTypes', order: 4, visible: true, access: 'user'   },

  // ── planning ──
  { id: 'kanban',   label: 'Kanban',         icon: 'Columns3',    category: 'planning', order: 0, visible: true, access: 'user'   },
  { id: 'planning', label: 'Planning',       icon: 'CalendarCheck',category: 'planning', order: 1, visible: true, access: 'user'  },
  { id: 'timeline', label: 'Gantt',          icon: 'GanttChart',  category: 'planning', order: 2, visible: true, access: 'public' },
  { id: 'calendar', label: 'Calendrier',     icon: 'Calendar',    category: 'planning', order: 3, visible: true, access: 'public' },
  { id: 'burndown', label: 'Burndown',       icon: 'TrendingDown',category: 'planning', order: 4, visible: true, access: 'user'   },
  { id: 'cfd',      label: 'Flux cumulatif', icon: 'Layers',      category: 'planning', order: 5, visible: true, access: 'user'   },
  { id: 'pert',     label: 'PERT',           icon: 'GitMerge',    category: 'planning', order: 6, visible: true, access: 'user'   },
  { id: 'priority', label: 'Priorités',      icon: 'Flame',       category: 'planning', order: 7, visible: true, access: 'user'   },

  // ── exploration ──
  { id: 'mindmap',    label: 'Carte mentale', icon: 'Share2',     category: 'exploration', order: 0, visible: true, access: 'public' },
  { id: 'graph',      label: 'Graphe',        icon: 'Network',    category: 'exploration', order: 1, visible: true, access: 'user'   },
  { id: 'sunburst',   label: 'Sunburst',      icon: 'CircleDot',  category: 'exploration', order: 2, visible: true, access: 'user'   },
  { id: 'relations',  label: 'Relations',     icon: 'Waypoints',  category: 'exploration', order: 3, visible: true, access: 'user'   },
  { id: 'bubble',     label: 'Bulles',        icon: 'Circle',     category: 'exploration', order: 4, visible: true, access: 'user'   },
  { id: 'radialTree', label: 'Arbre radial',  icon: 'Orbit',      category: 'exploration', order: 5, visible: true, access: 'user'   },
  { id: 'treemap',    label: 'Treemap',       icon: 'SquareStack',category: 'exploration', order: 6, visible: true, access: 'public' },
  { id: 'chord',      label: 'Chord',         icon: 'Disc',       category: 'exploration', order: 7, visible: true, access: 'user'   },
  { id: 'heatmap',    label: 'Heatmap',       icon: 'Grid3x3',    category: 'exploration', order: 8, visible: true, access: 'user'   },
  { id: 'ego',        label: 'Réseau ego',    icon: 'Focus',      category: 'exploration', order: 9, visible: true, access: 'user'   },
];

/*
 * Registre central des vues d'espace (id, libellé, icône, catégorie, ordre, niveau d'accès, masquage mobile).
 * Source unique : toute liste de vues se dérive d'ici (MOBILE_HIDDEN_VIEWS, catégories…), jamais de copie dans une page.
 * `access` contrôle la visibilité via useMenuItems (public < user < admin) — ne pas confondre avec
 * les modes d'interface (forum/projet/loisirs/tous, cf. stores/interfaceMode.ts) qui choisissent seulement les vues
 * favorites affichées en boutons directs (SpaceToolbar, MODE_PRIMARY_VIEWS) ; aucune vue n'est masquée par un mode.
 * Un visiteur non connecté a les mêmes vues qu'un connecté (décision Thomas 2026-11-06) : seul 'admin' reste réservé.
 * Surcharges possibles dans /admin/views (AppConfig menu_overrides), qui priment sur ce registre.
 * `mobileHidden` : bouton de vue masqué sous 640 px dans la barre de vues (SpaceViewSelector), grisé dans « Toutes les vues ».
 * bugs retirée le 2026-11-11 (remplacée par le filtre Tags et la vue Tags) : une vue absente du registre ouvre la
 * Liste (apps/web/src/lib/spaceDefaultView.ts, knownViewOr).
 * Catégories (réorganisation 2026-11-13, une seule taxonomie) : Contenus (lire, échanger, médias), Organisation
 * (classer), Suivi (avancement), Planification (temps, enchaînements), Exploration (relations). Libellés et ordre des
 * catégories : SPACE_VIEW_SECTIONS (menuDefaults.ts), seule liste des catégories — ne jamais la recopier dans le web.
 * « Todo » renommée « À faire » et Documents en icône Paperclip (distincte de Texte) le 2026-11-13.
 * ViewId (2026-11-13, centralisation des référentiels) : type des identifiants dérivé du registre — le web
 * (stores/viewMode.ts, ViewMode) l'utilise au lieu d'une union écrite à la main. Ajouter une vue = une entrée ici.
 * Catégorie « Par type » (bytype, demande Thomas 2026-11-27) : les vues qui montrent une seule sorte d'élément ou de
 * contenu, ou les rangent par type, auparavant éparpillées. Le même jour, toutes les catégories ont été réalignées
 * sur la carte mentale de Thomas (espace « les menus et vues ») : Liste et Arborescence en Contenus, Carte mentale /
 * PERT / Tags en Organisation, À faire / Kanban / Priorités en Planification. Deuxième passe (même jour) : Suivi supprimée, ses vues admin
 * réparties (Assignations → Organisation, Flux cumulatif et Heatmap → Planification, Burndown → Exploration).
 * Accès repris du tag « admin » de la carte (2026-11-27) : Graphe et Treemap passent admin, Bulles et Assignations
 * public ; Tableau croisé (absent de la carte) public à la demande de Thomas.
 */
export type ViewCategoryId = 'content' | 'bytype' | 'organize' | 'planning' | 'exploration';

export interface ViewDefinition {
  id: string;
  label: string;
  icon: string;
  category: ViewCategoryId;
  order: number; // within-category
  visible: boolean;
  access: 'public' | 'user' | 'admin';
  mobileHidden?: boolean;
}

const VIEW_DEFINITIONS = [
  // Rangement aligné sur la carte mentale de Thomas (espace « les menus et vues », 2026-11-27)
  // ── Contenus : lire, échanger, parcourir ──
  { id: 'thread',     label: 'Discussions',    icon: 'MessageSquare', category: 'content',     order: 0, visible: true, access: 'public' },
  { id: 'text',       label: 'Texte',          icon: 'FileText',      category: 'content',     order: 1, visible: true, access: 'public' },
  { id: 'recent',     label: 'Récents',        icon: 'Clock',         category: 'content',     order: 2, visible: true, access: 'public' },
  { id: 'list',       label: 'Liste',          icon: 'List',          category: 'content',     order: 3, visible: true, access: 'public' },
  { id: 'tree',       label: 'Arborescence',   icon: 'GitBranch',     category: 'content',     order: 4, visible: true, access: 'public' },

  // ── Par type : une seule sorte d'élément ou de contenu, ou rangé par type ──
  { id: 'articles',   label: 'Articles',       icon: 'Newspaper',     category: 'bytype',      order: 0, visible: true, access: 'public' },
  { id: 'process',    label: 'Process',        icon: 'Workflow',      category: 'bytype',      order: 1, visible: true, access: 'public', mobileHidden: true },
  { id: 'images',     label: 'Images',         icon: 'Image',         category: 'bytype',      order: 2, visible: true, access: 'public' },
  { id: 'documents',  label: 'Documents',      icon: 'Paperclip',     category: 'bytype',      order: 3, visible: true, access: 'public' },
  { id: 'links',      label: 'Liens',          icon: 'ExternalLink',  category: 'bytype',      order: 4, visible: true, access: 'public' },
  { id: 'types',      label: 'Types',          icon: 'LayoutGrid',    category: 'bytype',      order: 5, visible: true, access: 'public', mobileHidden: true },

  // ── Organisation : structurer, relier, classer, répartir ──
  { id: 'mindmap',    label: 'Carte mentale',  icon: 'Share2',        category: 'organize',    order: 0, visible: true, access: 'public' },
  { id: 'pert',       label: 'PERT',           icon: 'GitMerge',      category: 'organize',    order: 1, visible: true, access: 'public' },
  { id: 'tags',       label: 'Tags',           icon: 'Tags',          category: 'organize',    order: 2, visible: true, access: 'public', mobileHidden: true },
  { id: 'members',    label: 'Assignations',   icon: 'Users',         category: 'organize',    order: 3, visible: true, access: 'public', mobileHidden: true },
  { id: 'crossTable', label: 'Tableau croisé', icon: 'Table2',        category: 'organize',    order: 4, visible: true, access: 'public', mobileHidden: true }, // public depuis le 2026-11-27

  // ── Planification : à faire, avancement, dates ──
  { id: 'todo',       label: 'À faire',        icon: 'CheckSquare',   category: 'planning',    order: 0, visible: true, access: 'public' },
  { id: 'kanban',     label: 'Kanban',         icon: 'Columns3',      category: 'planning',    order: 1, visible: true, access: 'public', mobileHidden: true },
  { id: 'priority',   label: 'Priorités',      icon: 'Flame',         category: 'planning',    order: 2, visible: true, access: 'public' },
  { id: 'timeline',   label: 'Gantt',          icon: 'GanttChart',    category: 'planning',    order: 3, visible: true, access: 'public', mobileHidden: true },
  { id: 'calendar',   label: 'Calendrier',     icon: 'Calendar',      category: 'planning',    order: 4, visible: true, access: 'public' },
  { id: 'planning',   label: 'Planning',       icon: 'CalendarCheck', category: 'planning',    order: 5, visible: true, access: 'public', mobileHidden: true },
  { id: 'cfd',        label: 'Flux cumulatif', icon: 'Layers',        category: 'planning',    order: 6, visible: true, access: 'admin', mobileHidden: true },
  { id: 'heatmap',    label: 'Heatmap',        icon: 'Grid3x3',       category: 'planning',    order: 7, visible: true, access: 'admin', mobileHidden: true },

  // ── Exploration : relations ──
  { id: 'graph',      label: 'Graphe',        icon: 'Network',    category: 'exploration', order: 1, visible: true, access: 'admin', mobileHidden: true },
  { id: 'sunburst',   label: 'Sunburst',      icon: 'CircleDot',  category: 'exploration', order: 2, visible: true, access: 'admin', mobileHidden: true },
  { id: 'relations',  label: 'Relations',     icon: 'Waypoints',  category: 'exploration', order: 3, visible: true, access: 'admin', mobileHidden: true },
  { id: 'bubble',     label: 'Bulles',        icon: 'Circle',     category: 'exploration', order: 4, visible: true, access: 'public', mobileHidden: true },
  { id: 'radialTree', label: 'Arbre radial',  icon: 'Orbit',      category: 'exploration', order: 5, visible: true, access: 'admin', mobileHidden: true },
  { id: 'treemap',    label: 'Treemap',       icon: 'SquareStack',category: 'exploration', order: 6, visible: true, access: 'admin', mobileHidden: true },
  { id: 'chord',      label: 'Chord',         icon: 'Disc',       category: 'exploration', order: 7, visible: true, access: 'admin', mobileHidden: true },
  { id: 'burndown',   label: 'Burndown',      icon: 'TrendingDown', category: 'exploration', order: 8, visible: true, access: 'admin', mobileHidden: true },
  { id: 'ego',        label: 'Réseau ego',    icon: 'Focus',      category: 'exploration', order: 9, visible: true, access: 'admin', mobileHidden: true },
  { id: 'loupe',      label: 'Loupe',         icon: 'ZoomIn',     category: 'exploration', order: 10, visible: true, access: 'public', mobileHidden: true },
] as const satisfies readonly ViewDefinition[];

/** Identifiant d'une vue d'espace, dérivé du registre (le ViewMode du web en est un alias — jamais d'union à la main). */
export type ViewId = (typeof VIEW_DEFINITIONS)[number]['id'];

export const VIEW_REGISTRY: readonly ViewDefinition[] = VIEW_DEFINITIONS;

/** Vues dont le bouton est masqué sur mobile, dérivées du registre. */
export const MOBILE_HIDDEN_VIEWS: ReadonlySet<string> = new Set(VIEW_REGISTRY.filter((v) => v.mobileHidden).map((v) => v.id));

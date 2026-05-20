import type { ViewConfigItem, ViewCategoryConfig, GlobalPageConfig, GlobalPageGroupConfig } from '../types/viewConfig.js';
import { VIEW_REGISTRY } from './viewRegistry.js';

export const DEFAULT_VIEW_CATEGORIES: ViewCategoryConfig[] = [
  { id: 'dashboard', label: 'Tableau de bord', order: 0 },
  { id: 'basic',     label: 'Basique',         order: 1 },
  { id: 'itemTypes', label: 'Types',           order: 2 },
  { id: 'planning',  label: 'Planification',   order: 3 },
  { id: 'exploration', label: 'Exploration',   order: 4 },
];

// Global order base per category — keeps views grouped when sorted globally
const CATEGORY_GLOBAL_BASE: Record<string, number> = {
  basic: 0, itemTypes: 100, planning: 200, exploration: 300,
};

export const DEFAULT_VIEW_CONFIG: ViewConfigItem[] = VIEW_REGISTRY.map(v => ({
  id: v.id,
  label: v.label,
  icon: v.icon,
  category: v.category,
  order: CATEGORY_GLOBAL_BASE[v.category] + v.order,
  visible: v.visible,
  access: v.access,
}));

export const DEFAULT_GLOBAL_PAGE_GROUPS: GlobalPageGroupConfig[] = [
  { id: 'global',       label: 'Vues globales',   order: 0 },
  { id: 'myActivities', label: 'Mes activités',   order: 1 },
  { id: 'misc',         label: 'Divers',           order: 2 },
];

export const DEFAULT_GLOBAL_PAGES: GlobalPageConfig[] = [
  { id: 'home',        label: 'Accueil',        icon: 'Home',          group: 'global',       order: 0,   visible: true, access: 'user'   },
  { id: 'communities', label: 'Communautés',    icon: 'Users',         group: 'global',       order: 1,   visible: true, access: 'user'   },
  { id: 'spaces',      label: 'Espaces',        icon: 'FolderKanban',  group: 'global',       order: 2,   visible: true, access: 'user'   },
  { id: 'sunburst',    label: 'Sunburst',       icon: 'CircleDot',     group: 'global',       order: 3,   visible: true, access: 'user'   },
  { id: 'mindmap',     label: 'Carte mentale',  icon: 'GitBranch',     group: 'global',       order: 4,   visible: true, access: 'user'   },
  { id: 'graph',       label: 'Graphe global',  icon: 'Network',       group: 'global',       order: 5,   visible: true, access: 'user'   },
  { id: 'planning',    label: 'Tableau de bord',icon: 'LayoutDashboard',group: 'myActivities', order: 6,  visible: true, access: 'user'   },
  { id: 'search',      label: 'Recherche',      icon: 'Search',        group: 'misc',         order: 100, visible: true, access: 'user'   },
  { id: 'profile',     label: 'Profil',         icon: 'User',          group: 'misc',         order: 101, visible: true, access: 'user'   },
  { id: 'sitemap',     label: 'Plan du site',   icon: 'MapIcon',       group: 'misc',         order: 102, visible: true, access: 'public' },
  { id: 'logout',      label: 'Deconnexion',    icon: 'LogOut',        group: 'misc',         order: 103, visible: true, access: 'user'   },
];

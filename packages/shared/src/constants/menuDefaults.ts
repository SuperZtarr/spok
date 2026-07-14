/* MENU_REGISTRY : items de menu par défaut (globaux, vues, admin) — overrides via AppConfig menu_overrides. */
import type { MenuItemConfig } from '../types/menuItem.js';
import { VIEW_REGISTRY } from './viewRegistry.js';

const SECTION_META: Record<string, { sectionLabel: string; sectionOrder: number }> = {
  basic:       { sectionLabel: 'Basique',        sectionOrder: 2 },
  itemTypes:   { sectionLabel: 'Types',           sectionOrder: 3 },
  planning:    { sectionLabel: 'Planification',   sectionOrder: 4 },
  exploration: { sectionLabel: 'Exploration',     sectionOrder: 5 },
};

const VIEW_MENU_ITEMS: MenuItemConfig[] = VIEW_REGISTRY.map(v => ({
  id: '',
  key: v.id,
  label: v.label,
  icon: v.icon,
  section: v.category,
  sectionLabel: SECTION_META[v.category].sectionLabel,
  sectionOrder: SECTION_META[v.category].sectionOrder,
  route: null,
  viewMode: v.id,
  order: v.order,
  visible: v.visible,
  access: v.access,
}));

export const MENU_REGISTRY: MenuItemConfig[] = [
  // ── global ──
  { id: '', key: 'home',          label: 'Accueil',         icon: 'Home',          section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/',                    viewMode: null, order: 0, visible: true, access: 'public' },
  { id: '', key: 'communities',   label: 'Communautés',     icon: 'Users',         section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/communities',         viewMode: null, order: 1, visible: true, access: 'public' },
  { id: '', key: 'spaces',        label: 'Espaces',         icon: 'FolderKanban',  section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/spaces',              viewMode: null, order: 2, visible: true, access: 'public' },
  { id: '', key: 'global-sunburst',label: 'Sunburst',       icon: 'CircleDot',     section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/sunburst',            viewMode: null, order: 3, visible: true, access: 'public' },
  { id: '', key: 'global-mindmap', label: 'Carte mentale',  icon: 'GitBranch',     section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/mindmap',             viewMode: null, order: 4, visible: true, access: 'user'   },
  { id: '', key: 'global-graph',   label: 'Graphe global',  icon: 'Network',       section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/graph',               viewMode: null, order: 5, visible: true, access: 'user'   },
  { id: '', key: 'global-links',   label: 'Liens',          icon: 'ExternalLink',  section: 'global',    sectionLabel: 'Global',        sectionOrder: 0, route: '/links',               viewMode: null, order: 6, visible: true, access: 'user'   },

  // ── personal ──
  { id: '', key: 'today',     label: 'Ma journée',      icon: 'Sun',             section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/today',     viewMode: null, order: 0, visible: true, access: 'user' },
  { id: '', key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/dashboard', viewMode: null, order: 1, visible: true, access: 'user' },
  { id: '', key: 'tasks',     label: 'Tâches',          icon: 'ClipboardList',   section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/tasks',     viewMode: null, order: 2, visible: true, access: 'user' },
  { id: '', key: 'activity',  label: 'Activité',        icon: 'Activity',        section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: '/activity',  viewMode: null, order: 3, visible: true, access: 'user' },
  { id: '', key: 'profile',   label: 'Profil',          icon: 'User',            section: 'personal', sectionLabel: 'Personnel', sectionOrder: 1, route: null,         viewMode: null, order: 4, visible: true, access: 'user' },

  // ── space views (generated from VIEW_REGISTRY) ──
  ...VIEW_MENU_ITEMS,

  // ── admin ──
  { id: '', key: 'admin-communities', label: 'Communautés',     icon: 'Building2',    section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/communities',  viewMode: null, order: 0, visible: true, access: 'admin' },
  { id: '', key: 'admin-spaces',      label: 'Espaces',         icon: 'FolderKanban', section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/spaces',       viewMode: null, order: 1, visible: true, access: 'admin' },
  { id: '', key: 'admin-users',       label: 'Utilisateurs',    icon: 'Users',        section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/users',        viewMode: null, order: 2, visible: true, access: 'admin' },
  { id: '', key: 'admin-stats',       label: 'Statistiques',    icon: 'BarChart3',    section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/stats',        viewMode: null, order: 3, visible: true, access: 'admin' },
  { id: '', key: 'admin-audit',       label: 'Audit',           icon: 'History',      section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/audit-logs',   viewMode: null, order: 4, visible: true, access: 'admin' },
  { id: '', key: 'admin-anomalies',   label: 'Diagnostics',     icon: 'AlertTriangle',section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/anomalies',    viewMode: null, order: 5, visible: true, access: 'admin' },
  { id: '', key: 'admin-duplicates',  label: 'Doublons',        icon: 'Copy',         section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/duplicates',   viewMode: null, order: 6, visible: true, access: 'admin' },
  { id: '', key: 'admin-referentiels',label: 'Référentiels',    icon: 'Settings',     section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/referentiels', viewMode: null, order: 8, visible: true, access: 'admin' },
  { id: '', key: 'admin-api-doc',     label: 'Documentation API',icon: 'FileText',    section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/api-doc',      viewMode: null, order: 9, visible: true, access: 'admin' },

  // ── misc ──
  { id: '', key: 'search',  label: 'Recherche',    icon: 'Search',      section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/search',  viewMode: null, order: 0, visible: true, access: 'user'   },
  { id: '', key: 'contact', label: 'Contact',      icon: 'MessageSquare',section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/contact', viewMode: null, order: 1, visible: true, access: 'public' },
  { id: '', key: 'sitemap', label: 'Plan du site', icon: 'MapIcon',     section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/sitemap', viewMode: null, order: 2, visible: true, access: 'public' },
  { id: '', key: 'logout',  label: 'Déconnexion',  icon: 'LogOut',      section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: null,       viewMode: null, order: 3, visible: true, access: 'user'   },
];

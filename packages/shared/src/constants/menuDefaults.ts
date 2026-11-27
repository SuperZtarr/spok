/* MENU_REGISTRY : items de menu par défaut (globaux, vues, admin) — overrides via AppConfig menu_overrides.
   Une icône nouvelle doit être déclarée dans apps/web/src/constants/viewIcons.ts (test viewIcons.test.ts).
   Libellés : ici seulement — aide, plan du site et titres de page les lisent par menuLabel(key), jamais recopiés.
   Section « Tout SPOK » (overview, 2026-11-18) : pages qui couvrent tout SPOK, nommées d'après ce qu'elles montrent,
   jamais du nom d'une vue d'espace (test apps/web/src/lib/menuRegistry.test.ts) — Thomas confondait « Carte mentale » globale et vue.
   news (2026-11-11) : accès direct à « Toutes les nouveautés » depuis le bandeau, après Plan du site.
   admin-tags (2026-11-11) : tags globaux et doublons de tags (/admin/tags, icône Tag).
   admin-news (2026-11-12) : publication des nouveautés (/admin/news, icône Sparkles déjà déclarée pour news).
   Vues d'espace en 5 catégories (2026-11-13 ; 2026-11-27 : « Par type » ajoutée, « Suivi » supprimée) : SPACE_VIEW_SECTIONS ci-dessous, seule liste des catégories.
   Carte des espaces (global-mindmap) en icône Share2, comme la vue d'espace (2026-11-13). */
import type { MenuItemConfig } from '../types/menuItem.js';
import { VIEW_REGISTRY, type ViewCategoryId } from './viewRegistry.js';

/** Catégories des vues d'espace, dans l'ordre d'affichage (réorganisation 2026-11-13) : seule liste des catégories.
 *  GlobalNavBar, Layout, useMenuItems, ViewsConfigPage, LandingPage et SpaceToolbar la lisent — ne jamais la recopier.
 *  sectionOrder 2 à 6 : entre « personal » (1) et « misc » (7) ; « Par type » (2026-11-27) en 2.5, après Contenus. */
export const SPACE_VIEW_SECTIONS: { id: ViewCategoryId; label: string; sectionOrder: number }[] = [
  { id: 'content',     label: 'Contenus',      sectionOrder: 2 },
  { id: 'bytype',      label: 'Par type',      sectionOrder: 2.5 },
  { id: 'organize',    label: 'Organisation',  sectionOrder: 3 },
  { id: 'planning',    label: 'Planification', sectionOrder: 5 },
  { id: 'exploration', label: 'Exploration',   sectionOrder: 6 },
];

/** Identifiants des catégories de vues d'espace (sections du menu rendues par SpaceToolbar, pas par le bandeau). */
export const SPACE_VIEW_SECTION_IDS: ReadonlySet<string> = new Set(SPACE_VIEW_SECTIONS.map((s) => s.id));

const SECTION_META: Record<string, { sectionLabel: string; sectionOrder: number }> = Object.fromEntries(
  SPACE_VIEW_SECTIONS.map((s) => [s.id, { sectionLabel: s.label, sectionOrder: s.sectionOrder }]),
);

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
  // ── Tout SPOK : vues d'ensemble de toutes les communautés (sectionOrder 0.5 : entre « global » et « personal ») ──
  { id: '', key: 'global-mindmap', label: 'Carte des espaces',   icon: 'Share2',       section: 'overview', sectionLabel: 'Tout SPOK', sectionOrder: 0.5, route: '/mindmap',  viewMode: null, order: 0, visible: true, access: 'user'   },
  { id: '', key: 'global-sunburst',label: 'Panorama',            icon: 'CircleDot',    section: 'overview', sectionLabel: 'Tout SPOK', sectionOrder: 0.5, route: '/sunburst', viewMode: null, order: 1, visible: true, access: 'public' },
  { id: '', key: 'global-graph',   label: 'Réseau des éléments', icon: 'Network',      section: 'overview', sectionLabel: 'Tout SPOK', sectionOrder: 0.5, route: '/graph',    viewMode: null, order: 2, visible: true, access: 'user'   },
  { id: '', key: 'global-links',   label: 'Tous les liens',      icon: 'ExternalLink', section: 'overview', sectionLabel: 'Tout SPOK', sectionOrder: 0.5, route: '/links',    viewMode: null, order: 3, visible: true, access: 'user'   },

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
  { id: '', key: 'admin-tags',        label: 'Tags',            icon: 'Tag',          section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/tags',         viewMode: null, order: 7, visible: true, access: 'admin' },
  { id: '', key: 'admin-referentiels',label: 'Référentiels',    icon: 'Settings',     section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/referentiels', viewMode: null, order: 8, visible: true, access: 'admin' },
  { id: '', key: 'admin-api-doc',     label: 'Documentation API',icon: 'FileText',    section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/api-doc',      viewMode: null, order: 9, visible: true, access: 'admin' },
  { id: '', key: 'admin-views',       label: 'Vues',            icon: 'LayoutDashboard', section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/views',     viewMode: null, order: 10, visible: true, access: 'admin' },
  { id: '', key: 'admin-perf',        label: 'Performances',    icon: 'Activity',     section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/perf',         viewMode: null, order: 11, visible: true, access: 'admin' },
  // Publication des nouveautés (2026-11-12) : masquer, dater ou programmer une annonce (NewsAdminPage)
  { id: '', key: 'admin-news',        label: 'Nouveautés',      icon: 'Sparkles',     section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/news',         viewMode: null, order: 12, visible: true, access: 'admin' },
  // Volumétrie (2026-11-18) : taille et croissance des tables, seuils du registre volumetry.ts (icône BarChart3 déjà déclarée)
  { id: '', key: 'admin-volumetry',   label: 'Volumétrie',      icon: 'BarChart3',    section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/volumetry',    viewMode: null, order: 13, visible: true, access: 'admin' },

  // ── misc ──
  { id: '', key: 'search',  label: 'Recherche',    icon: 'Search',      section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/search',  viewMode: null, order: 0, visible: true, access: 'user'   },
  { id: '', key: 'contact', label: 'Contact',      icon: 'MessageSquare',section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/contact', viewMode: null, order: 1, visible: true, access: 'public' },
  { id: '', key: 'sitemap', label: 'Plan du site', icon: 'MapIcon',     section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/sitemap', viewMode: null, order: 2, visible: true, access: 'public' },
  { id: '', key: 'news',    label: 'Nouveautés',   icon: 'Sparkles',    section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: '/news',    viewMode: null, order: 3, visible: true, access: 'public' },
  { id: '', key: 'logout',  label: 'Déconnexion',  icon: 'LogOut',      section: 'misc', sectionLabel: 'Divers', sectionOrder: 7, route: null,       viewMode: null, order: 4, visible: true, access: 'user'   },
];

/** Libellé d'une entrée du menu (MENU_REGISTRY) : titres d'aide, plan du site et titres de page le lisent ici au lieu
 *  de le recopier. Les surcharges admin ne touchent que visible/access, donc ce libellé est bien celui affiché.
 *  Clé inconnue → erreur (un renommage de clé doit casser le build/les tests, pas afficher un titre vide). */
export function menuLabel(key: string): string {
  const entry = MENU_REGISTRY.find((m) => m.key === key);
  if (!entry) throw new Error(`menuLabel : clé de menu inconnue « ${key} »`);
  return entry.label;
}

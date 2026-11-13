/*
 * Registre des modes d'interface — SEULE source des modes (décision Thomas 2026-11-13, centralisation des
 * référentiels : les modes étaient décrits par 7 listes dans 5 fichiers). Une entrée par mode porte TOUTES ses
 * propriétés ; tout le reste en est dérivé, jamais recopié :
 * - InterfaceMode, CommunityContext, COMMUNITY_CONTEXTS (validation API z.enum) ;
 * - libellés et boutons de l'en-tête (Layout), options du contexte (CommunitySettingsPage) ;
 * - favoris de la barre de vues (web lib/viewFavorites), vue d'ouverture (web lib/spaceDefaultView) ;
 * - pages globales masquées (web stores/interfaceMode, MODE_GLOBAL_EXCLUDED) ; fiche d'élément réduite (ItemEditModal) ;
 * - textes qui énumèrent les modes (web lib/modeTexts : aide, infobulles, businessRules).
 * `context` = valeur stockée en base (enum Prisma CommunityContext ; JDR = Loisirs, nom historique) ; null = mode
 * « Tous » (communauté neutre, hors communauté). Un test API vérifie que les contextes = l'enum Prisma ; un test
 * shared vérifie que favoris, vue d'ouverture et pages masquées existent (modeRegistry.test.ts).
 * Ajouter un mode : une entrée ici (+ la valeur dans l'enum Prisma si c'est un contexte de communauté).
 */

export interface InterfaceModeDefinition {
  /** Identifiant du mode dans l'interface */
  id: string;
  /** Libellé du mode (boutons de l'en-tête, nom devant les favoris) */
  label: string;
  /** Libellé du choix dans les paramètres de la communauté, s'il diffère (Tous → « Neutre ») */
  contextLabel?: string;
  /** Valeur du contexte de communauté en base ; null = pas de contexte (mode Tous) */
  context: string | null;
  /** À quoi sert le mode, en quelques mots (infobulle, paramètres de la communauté) */
  description: string;
  /** Vues favorites en boutons directs, dans l'ordre (ids de VIEW_REGISTRY) */
  favorites: readonly string[];
  /** Vue d'ouverture d'un espace sans vue réglée (id de VIEW_REGISTRY) */
  openingView: string;
  /** Pages de la navigation globale masquées dans ce mode (clés de MENU_REGISTRY) */
  globalExcluded: readonly string[];
  /** Fiche d'élément ouverte réduite (titre, description, contenus) plutôt que complète */
  itemModalCollapsed: boolean;
}

const PERSONAL_PAGES = ['dashboard', 'tasks', 'activity', 'today'] as const;

export const MODE_REGISTRY = [
  {
    id: 'forum', label: 'Forum', context: 'FORUM',
    description: 'Sujets et discussions',
    favorites: ['recent', 'thread', 'articles', 'calendar', 'images', 'links'], // ordre décidé par Thomas 2026-11-13
    openingView: 'recent',
    globalExcluded: ['global-graph', 'global-sunburst', 'global-links', 'global-mindmap', ...PERSONAL_PAGES],
    itemModalCollapsed: true,
  },
  {
    id: 'loisirs', label: 'Loisirs', context: 'JDR',
    description: 'Jeux, passions et activités ludiques',
    favorites: ['recent', 'thread', 'articles', 'images', 'documents', 'links','loupe'],
    openingView: 'loupe',
    globalExcluded: [ ...PERSONAL_PAGES ],
    itemModalCollapsed: true,
  },
  {
    id: 'projet', label: 'Projet', context: 'PROJECT',
    description: 'Sous-projets et pilotage',
    favorites: ['todo', 'kanban', 'timeline', 'pert', 'calendar', 'planning', 'priority', 'process', 'mindmap', 'loupe'],
    openingView: 'timeline',
    globalExcluded: ['global-sunburst', 'global-mindmap', 'global-graph', 'global-links'],
    itemModalCollapsed: false,
  },
  {
    id: 'documentation', label: 'Documentation', context: 'DOCUMENTATION',
    description: 'Wiki, procédures, savoir partagé',
    favorites: ['tree', 'text', 'articles','images', 'documents', 'links', 'tags','types', 'mindmap', 'loupe'],
    openingView: 'mindmap',
    globalExcluded: [...PERSONAL_PAGES],
    itemModalCollapsed: false,
  },
  {
    id: 'exploration', label: 'Exploration', context: 'EXPLORATION',
    description: 'Veille et sources reliées',
    favorites: ['links', 'tags','types', 'graph', 'loupe', 'mindmap', 'images'],
    openingView: 'mindmap',
    globalExcluded: [ ...PERSONAL_PAGES],
    itemModalCollapsed: false,
  },
  {
    id: 'tous', label: 'Tous', contextLabel: 'Neutre', context: null,
    description: 'Usage général',
    favorites: ['list', 'tree', 'types', 'kanban', 'mindmap', 'loupe'],
    openingView: 'list',
    globalExcluded: [],
    itemModalCollapsed: false,
  },
] as const satisfies readonly InterfaceModeDefinition[];

/** Identifiant d'un mode d'interface (dérivé du registre). */
export type InterfaceMode = (typeof MODE_REGISTRY)[number]['id'];

/** Contexte d'usage d'une communauté, valeur stockée en base (dérivé du registre ; null = neutre « Tous »). */
export type CommunityContext = Exclude<(typeof MODE_REGISTRY)[number]['context'], null>;

/** Contextes de communauté, dans l'ordre du registre — validation API (z.enum) et options des paramètres. */
export const COMMUNITY_CONTEXTS = MODE_REGISTRY.flatMap((m) => (m.context ? [m.context] : [])) as unknown as readonly [CommunityContext, ...CommunityContext[]];

/** Mode par défaut quand rien n'en décide (hors communauté, communauté neutre). */
export const DEFAULT_INTERFACE_MODE: InterfaceMode = 'tous';

const BY_ID = new Map<string, InterfaceModeDefinition>(MODE_REGISTRY.map((m) => [m.id, m]));
const BY_CONTEXT = new Map<string, InterfaceModeDefinition>(MODE_REGISTRY.filter((m) => m.context).map((m) => [m.context as string, m]));

/** Définition d'un mode (mode inconnu → Tous). */
export function getInterfaceMode(id: string | null | undefined): InterfaceModeDefinition {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_INTERFACE_MODE)!;
}

/** Mode dérivé du contexte enregistré d'une communauté (null, inconnu → Tous). */
export function modeForContext(context: string | null | undefined): InterfaceMode {
  return ((context && BY_CONTEXT.get(context)?.id) || DEFAULT_INTERFACE_MODE) as InterfaceMode;
}

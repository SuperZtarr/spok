/*
 * Registre central des types d'élément (id, libellés, icône, emoji, teinte, groupe, fiche réduite, comportement de dates).
 * Source unique (2026-11-08, comme VIEW_REGISTRY pour les vues) : ITEM_TYPES, ItemType, DEFAULT_TYPE_LABELS, les tables
 * de ui.ts (icônes, libellés, emoji, groupes, colonnes), les z.enum de l'API et du MCP s'en dérivent. Ajouter un type =
 * une ligne ici + la valeur dans l'enum Prisma `ItemType` (un test compare les deux). Ne jamais recopier une liste ou une
 * table de types ailleurs : le test typeRegistry.guard.test.ts (projet api) échoue sur une copie.
 * `hue` : nom de teinte Tailwind ; les classes complètes et la valeur hexadécimale sont dans la palette web
 * (apps/web/src/constants/ui.ts, TYPE_HUE_PALETTE), car Tailwind ne lit pas ce paquet. Une communauté peut changer la
 * couleur d'un type (référentiels, typeLabels) : toujours passer par getTypeColor / getTypeHex côté web.
 * `display` : profil des infos sous le titre (vignette, bloc d'Article) — un nouveau type choisit un profil existant.
 * Lot 4 « contenus multiples » (2026-11-11) : Lien, Configuration, Document, Image, Anomalie, Diagramme ne sont plus des
 * types (médias = contenus de l'élément, config et bug = tags) ; « Non défini » s'appelle « Élément » (type par défaut).
 * La Note est fusionnée dans l'Élément (complément du lot 4, décision Thomas 2026-11-11) : un Élément sans contenu se
 * présente par le début de sa description (profil `content`, qui reprend l'ancien profil `text`).
 * `icon` : nom d'icône lucide, résolu par TYPE_ICON_COMPONENTS (ui.ts) — un test web vérifie qu'il est déclaré.
 */

export type TypeHue =
  | 'slate' | 'gray' | 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'cyan'
  | 'amber' | 'pink' | 'red' | 'indigo' | 'fuchsia' | 'sky' | 'yellow' | 'emerald';

export interface ItemTypeDefinition {
  id: string;
  /** Libellé au singulier (« Tâche ») */
  label: string;
  /** Libellé au pluriel (« Tâches ») : colonnes, filtres, référentiels */
  plural: string;
  /** Nom d'icône lucide */
  icon: string;
  /** Icône en texte (onglet du navigateur, où un composant ne passe pas) */
  emoji: string;
  hue: TypeHue;
  /**
   * Groupe du sélecteur de type de la fiche. `deliverables` (libellé « Compositions », 2026-11-11) = types à composants
   * propres (Article : blocs ; Question : réponses, votes, issue ; Process : canevas) : la fiche s'enregistre d'elle-même
   * dès qu'on choisit un de ces types, pour afficher ses composants (isComposedType).
   */
  group: 'default' | 'activities' | 'deliverables';
  /** Proposé dans la fiche réduite (Forum, Loisirs) : types qui portent un contenu, plus la Question (décision 2026-10-29) */
  content: boolean;
  /** Daté à l'heure près (sinon journée entière) */
  timed?: boolean;
  /** Durée proposée quand la fin se remplit d'après le début */
  defaultDuration?: 'hour' | 'day' | 'month';
  /**
   * Infos montrées sous le titre (vignette d'élément itemFace, ligne d'un bloc d'Article) : task = statut, échéance,
   * priorité ; project = statut, dates ; meeting = date et heure ; period = dates, durée ;
   * content = info du contenu principal (extension, site), rien sans contenu (le texte suit). Absent = statut (et type en carte).
   */
  display?: 'task' | 'project' | 'meeting' | 'period' | 'content';
  /**
   * Type sans statut : aucun statut proposé ni enregistré, absent du Kanban — typeHasStatus, lu par statusesForType /
   * statusForType / statusFamilies. Aucun type ne l'utilise aujourd'hui : la Période l'a eu du 2026-11-20 au
   * 2026-11-25, puis a retrouvé les statuts ordinaires (décision Thomas). Recopié dans mcp-core (NO_STATUS_TYPES).
   */
  noStatus?: boolean;
  /**
   * Statut posé à la création d'un élément de ce type sans statut, et au changement de type d'un élément sans statut
   * (décision Thomas 2026-11-25) — jamais sur un élément existant. Absent (Élément) = aucun (« Non défini »).
   * Lu par defaultStatusForType (defaultReferentiels.ts) : API, MCP (via l'API) et fiche.
   */
  defaultStatus?: string;
}

export const ITEM_TYPE_REGISTRY = [
  { id: 'UNDEFINED', label: 'Élément',    plural: 'Éléments',      icon: 'Box',                   emoji: '📦', hue: 'slate',   group: 'default',      content: true, display: 'content' },
  { id: 'PROJECT',   label: 'Projet',     plural: 'Projets',       icon: 'FolderKanban',          emoji: '📁', hue: 'purple',  group: 'activities',   content: false, defaultDuration: 'month', display: 'project', defaultStatus: 'todo' },
  { id: 'TASK',      label: 'Tâche',      plural: 'Tâches',        icon: 'CheckSquare',           emoji: '✅', hue: 'green',   group: 'activities',   content: false, defaultDuration: 'hour', display: 'task', defaultStatus: 'todo' },
  { id: 'MEETING',   label: 'Réunion',    plural: 'Réunions',      icon: 'Calendar',              emoji: '📅', hue: 'orange',  group: 'activities',   content: false, defaultDuration: 'hour', timed: true, display: 'meeting', defaultStatus: 'meeting_to_organize' },
  { id: 'PERIOD',    label: 'Période',    plural: 'Périodes',      icon: 'CalendarRange',         emoji: '🗓️', hue: 'teal',    group: 'activities',   content: false, defaultDuration: 'day', display: 'period', defaultStatus: 'scheduled' },
  { id: 'ARTICLE',   label: 'Article',    plural: 'Articles',      icon: 'Newspaper',             emoji: '📰', hue: 'fuchsia', group: 'deliverables', content: true, defaultStatus: 'article_draft' },
  { id: 'QUESTION',  label: 'Question',   plural: 'Questions',     icon: 'MessageCircleQuestion', emoji: '❓', hue: 'sky',     group: 'deliverables', content: true, defaultStatus: 'question_open' },
  // Process (2026-11-21) : canevas d'éléments de tous espaces (places, couloirs, liens), comme l'Article ; page dédiée
  { id: 'PROCESS',   label: 'Process',    plural: 'Process',       icon: 'Workflow',              emoji: '🔀', hue: 'indigo',  group: 'deliverables', content: false, defaultStatus: 'todo' },
] as const satisfies readonly ItemTypeDefinition[];

/** Identifiant d'un type d'élément, tiré du registre */
export type ItemType = (typeof ITEM_TYPE_REGISTRY)[number]['id'];

/** Liste des types dans l'ordre du registre (forme tuple pour z.enum) */
export const ITEM_TYPES = ITEM_TYPE_REGISTRY.map((t) => t.id) as unknown as readonly [ItemType, ...ItemType[]];

/** Type d'un élément créé sans choix */
export const DEFAULT_ITEM_TYPE: ItemType = 'UNDEFINED';

const BY_ID = new Map<string, ItemTypeDefinition>(ITEM_TYPE_REGISTRY.map((t) => [t.id, t]));

/** Définition d'un type, ou undefined s'il est inconnu (ancien type, valeur libre) */
export function getItemTypeDef(type: string | null | undefined): ItemTypeDefinition | undefined {
  return type ? BY_ID.get(type) : undefined;
}

/** Type à composants propres (groupe « Compositions » : Article, Question, Process) — enregistré dès qu'il est choisi dans la fiche */
export function isComposedType(type: string | null | undefined): boolean {
  return getItemTypeDef(type)?.group === 'deliverables';
}

/** Le type a-t-il un statut ? Non s'il porte noStatus (aucun aujourd'hui) ; type inconnu ou absent : oui */
export function typeHasStatus(type: string | null | undefined): boolean {
  return !getItemTypeDef(type)?.noStatus;
}

export function isItemType(value: unknown): value is ItemType {
  return typeof value === 'string' && BY_ID.has(value);
}

/** Types qui vérifient une propriété du registre, dans l'ordre du registre */
export function itemTypesWhere(pred: (t: ItemTypeDefinition) => boolean): ItemType[] {
  return ITEM_TYPE_REGISTRY.filter((t) => pred(t)).map((t) => t.id);
}

/*
 * Types de relation entre items — SOURCE UNIQUE côté web (décision Thomas 2026-09-28) : libellés,
 * libellé inverse, tournure de phrase, description, icône et couleurs des 4 types officiels
 * (RELATION_TYPES de @spok/shared, hors `parent` qui n'est pas proposé à l'utilisateur).
 * Règles :
 * - aucune vue ne redéfinit de table locale de libellés/couleurs : elle lit RELATION_TYPE_META /
 *   getRelationMeta ;
 * - ordonnancement (chemin critique Gantt, rangs PERT) : seuls `blocks` et `implements` ordonnent
 *   (from avant to) — isOrderingRelation. `drives` décale les dates (cascade) sans ordonner ;
 *   `relates` n'ordonne pas ;
 * - un type hors liste (ancien `depends`, `tests`/`duplicates` du seed) n'a aucun effet et s'affiche
 *   en gris sous son nom brut (getRelationMeta). L'API refuse désormais ces types.
 * Les classes Tailwind sont écrites en toutes lettres ici (détection des classes par Tailwind).
 */
import { Ban, ArrowRight, FastForward, Link2, HelpCircle, type LucideIcon } from 'lucide-react';

export type OfficialRelationType = 'blocks' | 'implements' | 'drives' | 'relates';

export interface RelationTypeMeta {
  id: string;
  /** Libellé dans le sens from → to (« Bloque ») */
  label: string;
  /** Libellé vu depuis la cible (« Bloqué par ») */
  inverseLabel: string;
  /** Tournure dans une phrase « A <verb> B » (« bloque ») */
  verb: string;
  description: string;
  Icon: LucideIcon;
  /** Couleur des arêtes / flèches / points */
  hex: string;
  /** Couleur de texte d'icône */
  textClass: string;
  /** Badge sens from → to */
  badgeClass: string;
  /** Badge vu depuis la cible */
  inverseBadgeClass: string;
  /** Option sélectionnée / survolée dans un choix de type */
  selectedClass: string;
  hoverClass: string;
}

export const RELATION_TYPE_META: Record<OfficialRelationType, RelationTypeMeta> = {
  blocks: {
    id: 'blocks', label: 'Bloque', inverseLabel: 'Bloqué par', verb: 'bloque',
    description: 'Contrainte dure — B ne peut démarrer avant la fin de A',
    Icon: Ban, hex: '#ef4444', textClass: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inverseBadgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    selectedClass: 'bg-red-50 border-red-400 dark:bg-red-950/30', hoverClass: 'hover:bg-red-50 hover:border-red-300',
  },
  implements: {
    id: 'implements', label: 'Permet', inverseLabel: 'Permis par', verb: 'permet',
    description: 'A permet/rend possible B',
    Icon: ArrowRight, hex: '#22c55e', textClass: 'text-green-500',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inverseBadgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    selectedClass: 'bg-green-50 border-green-400 dark:bg-green-950/30', hoverClass: 'hover:bg-green-50 hover:border-green-300',
  },
  drives: {
    id: 'drives', label: 'Entraîne', inverseLabel: 'Entraîné par', verb: 'entraîne',
    description: 'Déplacer A décale B du même nombre de jours',
    Icon: FastForward, hex: '#a855f7', textClass: 'text-purple-500',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    inverseBadgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    selectedClass: 'bg-purple-50 border-purple-400 dark:bg-purple-950/30', hoverClass: 'hover:bg-purple-50 hover:border-purple-300',
  },
  relates: {
    id: 'relates', label: 'Lié à', inverseLabel: 'Lié à', verb: 'est lié à',
    description: 'A et B doivent être traités ensemble',
    Icon: Link2, hex: '#3b82f6', textClass: 'text-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    inverseBadgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    selectedClass: 'bg-blue-50 border-blue-400 dark:bg-blue-950/30', hoverClass: 'hover:bg-blue-50 hover:border-blue-300',
  },
};

/** Ordre d'affichage des choix de type */
export const RELATION_TYPE_ORDER: OfficialRelationType[] = ['blocks', 'implements', 'drives', 'relates'];
export const RELATION_TYPE_LIST: RelationTypeMeta[] = RELATION_TYPE_ORDER.map((t) => RELATION_TYPE_META[t]);

export function isOfficialRelationType(type: string | null | undefined): type is OfficialRelationType {
  return !!type && Object.prototype.hasOwnProperty.call(RELATION_TYPE_META, type);
}

/** Métadonnées d'un type ; type hors liste → gris, libellé = nom brut, aucune sémantique. */
export function getRelationMeta(type: string | null | undefined): RelationTypeMeta {
  if (isOfficialRelationType(type)) return RELATION_TYPE_META[type];
  const raw = type || '?';
  return {
    id: raw, label: raw, inverseLabel: raw, verb: raw, description: 'Type de relation non reconnu',
    Icon: HelpCircle, hex: '#9ca3af', textClass: 'text-gray-400',
    badgeClass: 'bg-muted text-muted-foreground', inverseBadgeClass: 'bg-muted text-muted-foreground',
    selectedClass: 'bg-muted border-border', hoverClass: 'hover:bg-muted',
  };
}

/** Seuls `blocks` et `implements` ordonnent : from doit finir avant to (chemin critique, rangs PERT). */
export function isOrderingRelation(type: string | null | undefined): boolean {
  return type === 'blocks' || type === 'implements';
}

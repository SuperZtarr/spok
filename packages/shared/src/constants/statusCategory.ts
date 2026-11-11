/*
 * Catégories de statut (2026-11-08) : ce qu'un statut VEUT DIRE, indépendamment de son identifiant. Une communauté
 * peut créer ses propres statuts (référentiels) ; seule la catégorie dit s'il est fini, en cours, en retard…
 * Source unique de ce sens : toute règle (élément terminé exclu des listes actives, date de fin remplie, « en cours »,
 * « en retard », statut posé à la création, case à cocher « fait ») passe par ces fonctions, jamais par une
 * comparaison avec 'done', 'cancelled', 'in_progress'… (le test typeRegistry.guard.test.ts, projet api, le vérifie).
 *   none      : pas de statut (« Non défini », '', null, 'none')
 *   open      : à faire (À faire, Planifié, question Ouverte / Reportée)
 *   active    : en cours
 *   review    : à valider (travail fait, en attente de validation ; reste ouvert)
 *   late      : en retard (reste ouvert)
 *   done      : terminé (question Tranchée)
 *   cancelled : abandonné (Annulé, question Sans conclusion)
 * Un statut sans catégorie (personnalisé avant 2026-11-08) prend celle du statut par défaut de même id, sinon « open ».
 * Params `statuses` : statuts de la communauté de l'élément (référentiels) ; DEFAULT_STATUSES quand on ne les a pas
 * (pages transverses à plusieurs communautés).
 */
import type { StatusCategory, StatusConfig } from '../types/referentiels.js';
import { DEFAULT_STATUSES } from './defaultReferentiels.js';

/** Toutes les catégories (validation des référentiels enregistrés) */
export const STATUS_CATEGORIES = ['none', 'open', 'active', 'review', 'late', 'done', 'cancelled'] as const satisfies readonly StatusCategory[];

/** Catégories qu'un statut peut recevoir dans le réglage des statuts (none est réservé à « Non défini ») */
export const STATUS_CATEGORY_OPTIONS: { id: Exclude<StatusCategory, 'none'>; label: string }[] = [
  { id: 'open', label: 'À faire' },
  { id: 'active', label: 'En cours' },
  { id: 'review', label: 'À valider' },
  { id: 'late', label: 'En retard' },
  { id: 'done', label: 'Terminé' },
  { id: 'cancelled', label: 'Annulé' },
];

/** Catégories qui ferment un élément : sorti des listes actives, date de fin remplie */
export const CLOSED_CATEGORIES: StatusCategory[] = ['done', 'cancelled'];
/** Catégories d'un élément encore à traiter (« Non défini » compris) */
export const OPEN_CATEGORIES: StatusCategory[] = ['none', 'open', 'active', 'review', 'late'];

const isNoStatus = (id: string | null | undefined) => !id || id === 'undefined' || id === 'none';

export function statusCategory(statusId: string | null | undefined, statuses: StatusConfig[] = DEFAULT_STATUSES): StatusCategory {
  if (isNoStatus(statusId)) return 'none';
  const own = statuses.find((s) => s.id === statusId);
  if (own?.category) return own.category;
  return DEFAULT_STATUSES.find((s) => s.id === statusId)?.category ?? 'open';
}

export function isClosedStatus(statusId: string | null | undefined, statuses?: StatusConfig[]): boolean {
  return CLOSED_CATEGORIES.includes(statusCategory(statusId, statuses));
}

export function isStatusIn(statusId: string | null | undefined, categories: StatusCategory[], statuses?: StatusConfig[]): boolean {
  return categories.includes(statusCategory(statusId, statuses));
}

/**
 * Identifiants des statuts de ces catégories (filtres d'API, requêtes Prisma). Inclut toujours les statuts par défaut
 * de ces catégories, et 'none' si la catégorie none est demandée (l'API lit 'none' comme « sans statut »).
 */
export function statusIdsIn(categories: StatusCategory[], statuses: StatusConfig[] = DEFAULT_STATUSES): string[] {
  const ids = new Set<string>();
  for (const s of [...statuses, ...DEFAULT_STATUSES]) {
    if (s.id !== 'undefined' && categories.includes(statusCategory(s.id, statuses))) ids.add(s.id);
  }
  if (categories.includes('none')) ids.add('none');
  return [...ids];
}

/**
 * Statut à poser pour une catégorie (case « fait », création rapide « à faire ») : le premier statut visible de cette
 * catégorie dans l'ordre du référentiel, hors statuts réservés à un type, sinon le statut par défaut correspondant.
 */
export function firstStatusIn(category: Exclude<StatusCategory, 'none'>, statuses: StatusConfig[] = DEFAULT_STATUSES): string {
  const pick = (list: StatusConfig[]) => [...list]
    .sort((a, b) => a.order - b.order)
    .find((s) => s.visible && !s.types?.length && statusCategory(s.id, list) === category)?.id;
  return pick(statuses) ?? pick(DEFAULT_STATUSES) ?? category;
}

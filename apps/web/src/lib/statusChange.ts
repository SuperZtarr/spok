/*
 * Règles de dates d'un changement de statut côté web — source unique pour la fiche (ItemEditModal) et les
 * changements rapides (Kanban, menu ⋯, listes : useSpaceActions.handleInlineUpdate), pour qu'un même statut
 * produise les mêmes dates quel que soit le chemin (catalogue : lib/businessRules.ts, status-clear-dates,
 * status-autofill-start, status-autofill-end-terminal).
 *
 * statusChangeFields(newStatus, current, statuses, now) renvoie les champs à écrire :
 *   - « Non défini » (vide, null, 'undefined') → status null, début et fin effacés ;
 *   - statut qui ferme l'élément (catégorie Terminé ou Annulé, isClosedStatus) et fin vide → fin = now ;
 *   - autre statut défini et début vide → début = fin si elle est passée, sinon now.
 * Ne remplace jamais une date existante. Dates en ISO. `statuses` : statuts de la communauté (statut
 * personnalisé de catégorie Terminé). L'API remplit les mêmes dates (apps/api/src/utils/statusDates.ts) mais
 * n'efface jamais : l'effacement sur « Non défini » est un geste d'interface, pas une règle MCP.
 */
import { isClosedStatus, statusCategory, type StatusConfig } from '@spok/shared';

export interface StatusChangeFields {
  status: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** Vrai pour « Non défini » : vide, null, 'undefined' ou 'none' (catégorie none) */
export function isUndefinedStatus(status: string | null | undefined): boolean {
  return statusCategory(status) === 'none';
}

export function statusChangeFields(
  newStatus: string | null | undefined,
  current: { startDate?: string | null; endDate?: string | null },
  statuses?: StatusConfig[],
  now: Date = new Date(),
): StatusChangeFields {
  if (isUndefinedStatus(newStatus)) return { status: null, startDate: null, endDate: null };
  const status = newStatus as string;
  const result: StatusChangeFields = { status };
  const nowIso = now.toISOString();
  if (isClosedStatus(status, statuses) && !current.endDate) result.endDate = nowIso;
  if (!current.startDate) {
    const end = current.endDate || result.endDate || null;
    result.startDate = end && new Date(end) < now ? end : nowIso;
  }
  return result;
}

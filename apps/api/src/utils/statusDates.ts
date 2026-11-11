/*
 * Règles de dates liées au statut d'un item — source unique, appliquée par l'API (PATCH item et
 * propagation du statut aux descendants) pour que tous les chemins (modale, menu ⋯, Kanban, Today,
 * MCP) se comportent pareil. Miroir côté web : ItemEditModal / useSpaceActions.handleInlineUpdate
 * (pré-remplissage pour l'affichage immédiat) ; catalogue : apps/web/src/lib/businessRules.ts
 * (status-autofill-end-terminal, status-autofill-start).
 *
 * statusDateDefaults(status, current, now, statuses) renvoie uniquement les dates à REMPLIR :
 *   - statut qui ferme l'élément (catégorie terminé ou annulé, isClosedStatus) et fin vide → fin = now ;
 *   - statut défini (≠ null / 'undefined') et début vide → début = fin si elle est passée, sinon now.
 * Ne remplace jamais une date existante ; ne vide jamais rien (la règle « Non défini → vider les
 * dates » reste propre à la modale, pour qu'un appel API/MCP n'efface pas de dates par erreur).
 * `current` = dates après application du payload (une date envoyée explicitement, même null, n'est
 * pas à passer ici : l'appelant ne complète que les champs absents du payload).
 * `statuses` : statuts de la communauté de l'élément (utils/referentiels.ts statusesOfSpace), pour qu'un statut
 * personnalisé de catégorie « terminé » ferme aussi l'élément.
 */
import { isClosedStatus, type StatusConfig } from '@spok/shared';

export function statusDateDefaults(
  status: string | null | undefined,
  current: { startDate: Date | null; endDate: Date | null },
  now: Date = new Date(),
  statuses?: StatusConfig[],
): { startDate?: Date; endDate?: Date } {
  if (!status || status === 'undefined') return {};
  const result: { startDate?: Date; endDate?: Date } = {};
  if (isClosedStatus(status, statuses) && !current.endDate) result.endDate = now;
  if (!current.startDate) {
    const end = current.endDate ?? result.endDate ?? null;
    result.startDate = end && end < now ? end : now;
  }
  return result;
}

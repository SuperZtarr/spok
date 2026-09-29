/*
 * Libellé de l'accusé de lecture à l'assignation (décision Thomas 2026-09-29) — calcul côté API
 * (apps/api/src/utils/assignment.ts), ici seulement la présentation :
 * - null → pas d'indicateur (non assigné, auto-assigné, assignation antérieure au 2026-09-29)
 * - { seenAt: null } → « Pas encore vu » (orange)
 * - { seenAt } → « Vu par <nom> le 3 oct. » (gris)
 * Usage : modale item (sous « Assigné à »), infobulle de l'icône œil barré (vue Membres, page Tâches).
 */
import type { AssignmentReceipt } from '@spok/shared';

export interface AssignmentReceiptLabel {
  text: string;
  seen: boolean;
}

export function assignmentReceiptLabel(receipt: AssignmentReceipt | undefined, assigneeName?: string | null): AssignmentReceiptLabel | null {
  if (!receipt) return null;
  if (!receipt.seenAt) return { text: 'Pas encore vu', seen: false };
  const date = new Date(receipt.seenAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return { text: `Vu${assigneeName ? ` par ${assigneeName}` : ''} le ${date}`, seen: true };
}

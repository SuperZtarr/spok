/* Nom de l'assigné d'un élément, membre SPOK ou personne saisie librement (assignedToName, sans compte). Seul point de
 * lecture pour l'affichage et les exports. Les droits, notifications et « Mes tâches » lisent assignedToId, jamais ce nom. */
export function assigneeLabel(item: { assignedTo?: { name?: string | null } | null; assignedToName?: string | null }): string | null {
  return item.assignedTo?.name || item.assignedToName || null;
}

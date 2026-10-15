/*
 * Droits d'un MEMBER sur un item (règle assignee-can-manage-item, décision Thomas 2026-10-15) :
 * il modifie, supprime et déplace vers un autre espace les items qu'il a créés OU qui lui sont assignés.
 * Source unique pour les gardes de PATCH /items/:id, DELETE /items/:id et POST /items/bulk-move — ne pas
 * recopier la condition dans une route. Un OWNER (direct, de la communauté ou mode admin) n'en a pas besoin ;
 * le verrou des copies de séance (itemLock) s'applique en plus.
 */
export function canMemberManageItem(
  item: { createdById?: string | null; assignedToId?: string | null },
  userId: string,
): boolean {
  return item.createdById === userId || item.assignedToId === userId;
}

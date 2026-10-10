/*
 * Verrou des copies de séance live : un item avec lockedAt est la trace fidèle de ce qui a été présenté.
 * Seule l'organisation reste libre (parentId, tagIds via PATCH ; move/reorder/relations/commentaires
 * dans leurs routes). Toute route qui écrit le contenu d'un item DOIT appeler isLocked() — y compris
 * les opérations indirectes (propagation de statut, décalage de dates, split, merge, convert, upload).
 */
export const LOCKED_EDITABLE_FIELDS = new Set(['parentId', 'tagIds', 'updatedAt']);

export const LOCKED_MESSAGE = 'Élément de séance verrouillé : son contenu ne peut pas être modifié';

export function isLocked(item: { lockedAt?: Date | string | null } | null | undefined): boolean {
  return !!item?.lockedAt;
}

/** Champs du body interdits sur un item verrouillé (vide = modification autorisée). */
export function lockedFieldViolations(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((k) => body[k] !== undefined && !LOCKED_EDITABLE_FIELDS.has(k));
}

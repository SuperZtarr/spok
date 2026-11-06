/*
 * Règle « le parent d'un item est dans le même espace » : contrôle commun aux routes qui écrivent un parentId
 * (POST /, POST /from-template, PATCH /:id, PATCH /:id/move), sans quoi un membre pourrait désigner comme parent un
 * élément d'un espace privé puis lire ses champs.
 * parentViolation(prisma, parentId, spaceId, userId, isAdminMode) : message de refus (400), ou null si le parent convient.
 * Parent d'un autre espace lisible par l'utilisateur : message qui explique la règle. Parent absent ou dans un espace
 * illisible : même message générique, pour ne pas révéler qu'un id existe.
 * À n'appeler que si le parent change : un lien ancien entre espaces ne doit pas bloquer la modification de l'élément.
 */
import { filterReadableSpaceIds } from '../routes/items.js';

export const PARENT_OTHER_SPACE_MESSAGE = "Le parent doit être dans le même espace : déplacez d'abord l'élément dans cet espace";
export const PARENT_NOT_FOUND_MESSAGE = 'Parent introuvable dans cet espace';

export async function parentViolation(
  prisma: any,
  parentId: string,
  spaceId: string,
  userId: string | undefined,
  isAdminMode = false,
): Promise<string | null> {
  const parent = await prisma.item.findUnique({ where: { id: parentId }, select: { spaceId: true } });
  if (!parent) return PARENT_NOT_FOUND_MESSAGE;
  if (parent.spaceId === spaceId) return null;
  const readable = await filterReadableSpaceIds(prisma, userId, [parent.spaceId], isAdminMode);
  return readable.length > 0 ? PARENT_OTHER_SPACE_MESSAGE : PARENT_NOT_FOUND_MESSAGE;
}

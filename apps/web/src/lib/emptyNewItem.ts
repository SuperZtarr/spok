/*
 * Élément vide tout juste créé (« Nouveau », création de l'en-tête, sous-élément, double-clic Process…) : la création
 * écrit l'élément en base AVANT d'ouvrir sa fiche — refermer la fiche sans rien saisir laissait un élément vide.
 * ItemEditModal le supprime à la fermeture sans enregistrement quand shouldDiscardOnClose est vrai (2026-10-28).
 * - isItemEmpty : aucun contenu (titre, description, adresse, contenu/schéma, dates, priorité, assignation, étiquettes,
 *   sous-éléments, relations, contributions). Type, statut et parent ne comptent pas.
 * - isFreshDraft : créé par l'utilisateur au plus FRESH_DRAFT_MAX_AGE_MS avant l'ouverture de la fiche — un ancien
 *   élément vide qu'on rouvre n'est jamais supprimé.
 * Règle de gestion : empty-new-item-discarded (lib/businessRules.ts).
 */
import type { Item } from '@spok/shared';

export const FRESH_DRAFT_MAX_AGE_MS = 5 * 60 * 1000;

type ItemLike = Pick<Item, 'title' | 'description' | 'url' | 'content' | 'dueDate' | 'startDate' | 'endDate' | 'priority' | 'assignedToId' | 'tags'> & {
  contributions?: unknown[] | null;
  relationsFrom?: unknown[] | null;
  relationsTo?: unknown[] | null;
};

/** Texte visible d'une description HTML (éditeur) : '<p></p>' ou des espaces seuls = vide ; une image compte. */
const hasDescription = (html: string | null | undefined) =>
  !!html && (/<img\s/i.test(html) || html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0);

export function isItemEmpty(item: ItemLike, childCount: number): boolean {
  return !item.title?.trim()
    && !hasDescription(item.description)
    && !item.url?.trim()
    && !(item.content && Object.keys(item.content).length > 0)
    && !item.dueDate && !item.startDate && !item.endDate
    && item.priority == null
    && !item.assignedToId
    && !(item.tags?.length)
    && childCount === 0
    && !(item.contributions?.length)
    && !(item.relationsFrom?.length)
    && !(item.relationsTo?.length);
}

export function isFreshDraft(item: Pick<Item, 'createdAt' | 'createdById'>, userId: string | undefined, openedAt: number): boolean {
  if (!userId || item.createdById !== userId) return false;
  const age = openedAt - new Date(item.createdAt).getTime();
  return age >= -60_000 && age <= FRESH_DRAFT_MAX_AGE_MS; // tolérance d'horloge client/serveur d'une minute
}

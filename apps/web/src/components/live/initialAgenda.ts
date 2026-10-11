/*
 * Préparation initiale d'une séance (fenêtre « Préparer la séance ») — logique pure, testée à part.
 * buildAgendaChoices : éléments de PREMIER NIVEAU de l'espace parent (parentId null), dans leur ordre (position),
 *   avec le nombre de sous-éléments directs de chacun.
 * defaultSelection : tout coché, « avec les sous-éléments » activé partout (décision Thomas 2026-10-11).
 * toAgendaPayload : ce qui part à l'API (POST /live-sessions, champ agenda), dans l'ordre de la liste ;
 *   includeChildren n'est envoyé que pour un élément qui a des sous-éléments.
 */
import type { Item } from '@spok/shared';

export interface AgendaChoice {
  id: string;
  title: string;
  childCount: number;
}

export interface AgendaSelection {
  checked: boolean;
  withChildren: boolean;
}

export function buildAgendaChoices(items: Pick<Item, 'id' | 'title' | 'parentId' | 'position'>[]): AgendaChoice[] {
  const childCount = new Map<string, number>();
  for (const it of items) {
    if (it.parentId) childCount.set(it.parentId, (childCount.get(it.parentId) ?? 0) + 1);
  }
  return items
    .filter((it) => !it.parentId)
    .sort((a, b) => a.position - b.position)
    .map((it) => ({ id: it.id, title: it.title || 'Sans titre', childCount: childCount.get(it.id) ?? 0 }));
}

export function defaultSelection(choices: AgendaChoice[]): Record<string, AgendaSelection> {
  return Object.fromEntries(choices.map((c) => [c.id, { checked: true, withChildren: true }]));
}

export function toAgendaPayload(choices: AgendaChoice[], selection: Record<string, AgendaSelection>) {
  return choices
    .filter((c) => selection[c.id]?.checked)
    .map((c) => (c.childCount > 0
      ? { sourceItemId: c.id, includeChildren: !!selection[c.id]?.withChildren }
      : { sourceItemId: c.id }));
}

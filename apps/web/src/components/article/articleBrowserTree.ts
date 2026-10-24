/*
 * Arbre du sélecteur à parcourir d'un article (ArticleBrowser) — fonctions pures :
 * - buildBrowserRows(items, expanded, types) : lignes à afficher. Sans filtre : arbre parent > enfants (parent absent
 *   de la liste chargée → racine ; frères par position), enfants visibles seulement si leur parent est dans
 *   `expanded`. Avec un filtre de type : liste à plat des éléments de ces types, avec le titre de leur parent.
 * - orderSelection(selected, items, extra) : ids cochés dans l'ordre de l'arbre complet (préordre), puis ceux absents
 *   de la liste chargée (cochés depuis la recherche) dans l'ordre `extra`. Ordre d'insertion dans l'article.
 */
import type { ArticleBrowseItem } from '@spok/shared';

export type BrowserRow = { item: ArticleBrowseItem; depth: number; hasChildren: boolean; parentTitle: string | null };

function index(items: ArticleBrowseItem[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const children = new Map<string | null, ArticleBrowseItem[]>();
  for (const it of items) {
    const parent = it.parentId && byId.has(it.parentId) ? it.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(it);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.position - b.position);
  return { byId, children };
}

function preorder(items: ArticleBrowseItem[], expanded: Set<string> | null): { item: ArticleBrowseItem; depth: number; hasChildren: boolean }[] {
  const { children } = index(items);
  const out: { item: ArticleBrowseItem; depth: number; hasChildren: boolean }[] = [];
  const seen = new Set<string>();
  const visit = (it: ArticleBrowseItem, depth: number) => {
    if (seen.has(it.id)) return;
    seen.add(it.id);
    const kids = children.get(it.id) ?? [];
    out.push({ item: it, depth, hasChildren: kids.length > 0 });
    if (!expanded || expanded.has(it.id)) kids.forEach((k) => visit(k, depth + 1));
  };
  (children.get(null) ?? []).forEach((r) => visit(r, 0));
  return out;
}

export function buildBrowserRows(items: ArticleBrowseItem[], expanded: Set<string>, types: Set<string>): BrowserRow[] {
  if (types.size > 0) {
    const { byId } = index(items);
    return preorder(items, null)
      .filter((r) => types.has(r.item.type))
      .map((r) => ({ item: r.item, depth: 0, hasChildren: false, parentTitle: r.item.parentId ? byId.get(r.item.parentId)?.title ?? null : null }));
  }
  return preorder(items, expanded).map((r) => ({ ...r, parentTitle: null }));
}

export function orderSelection(selected: Set<string>, items: ArticleBrowseItem[], extra: string[]): string[] {
  const inTree = preorder(items, null).map((r) => r.item.id).filter((id) => selected.has(id));
  const known = new Set(inTree);
  return [...inTree, ...extra.filter((id) => selected.has(id) && !known.has(id))];
}

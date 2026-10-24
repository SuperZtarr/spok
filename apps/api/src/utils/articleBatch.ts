/*
 * Ordre d'insertion groupée dans un article (routes …/article/batch, item-article.ts) — fonctions pures, sans base :
 * - orderDescendants : racine puis descendance en profondeur d'abord (frères par position, puis createdAt) ;
 * - orderChain : éléments atteints par les relations SORTANTES blocks / implements / drives (jamais relates), en
 *   largeur d'abord, chaque élément une fois (boucles finies), racine exclue ;
 * - orderCluster : racine, descendants, puis chaîne, sans doublon ;
 * - orderProcess : couloirs par position (élément du couloir puis ses membres par x puis y), puis éléments hors
 *   couloir par x puis y ; laneId → ce couloir seul. Sans doublon.
 * Le filtrage (articles, présents, illisibles) et la limite de 100 sont appliqués par la route.
 */
const CHAIN_TYPES = new Set(['blocks', 'implements', 'drives']);

const unique = (ids: string[]) => [...new Set(ids)];

export function orderDescendants(
  rootId: string,
  items: { id: string; parentId: string | null; position: number; createdAt: Date }[],
): string[] {
  const children = new Map<string, typeof items>();
  for (const it of items) {
    if (!it.parentId) continue;
    const list = children.get(it.parentId) ?? [];
    list.push(it);
    children.set(it.parentId, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) ?? []) visit(c.id);
  };
  visit(rootId);
  return out;
}

export function orderChain(rootId: string, relations: { fromItemId: string; toItemId: string; type: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const next: string[] = [];
    for (const from of frontier) {
      for (const r of relations) {
        if (r.fromItemId !== from || !CHAIN_TYPES.has(r.type) || seen.has(r.toItemId)) continue;
        seen.add(r.toItemId);
        out.push(r.toItemId);
        next.push(r.toItemId);
      }
    }
    frontier = next;
  }
  return out;
}

export function orderCluster(rootId: string, descendants: string[] | null, chain: string[] | null): string[] {
  return unique([rootId, ...(descendants ?? []), ...(chain ?? [])]);
}

export function orderProcess(
  lanes: { id: string; itemId: string; position: number }[],
  nodes: { itemId: string; laneId: string | null; x: number; y: number }[],
  laneId?: string,
): string[] {
  const byXY = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x - b.x || a.y - b.y;
  const selected = [...lanes].filter((l) => !laneId || l.id === laneId).sort((a, b) => a.position - b.position);
  const out: string[] = [];
  for (const lane of selected) {
    out.push(lane.itemId);
    out.push(...nodes.filter((n) => n.laneId === lane.id).sort(byXY).map((n) => n.itemId));
  }
  if (!laneId) out.push(...nodes.filter((n) => !n.laneId).sort(byXY).map((n) => n.itemId));
  return unique(out);
}

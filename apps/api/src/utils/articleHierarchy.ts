/*
 * Hiérarchie des blocs d'un article (décision Thomas 2026-10-30) : un bloc dont l'élément descend d'un autre élément
 * présent dans l'article est un sous-niveau. depth = nombre d'ancêtres présents dans l'article (ancêtres absents
 * sautés), plafonné à 3 — le web en déduit la taille du titre et le décalage. Aucun identifiant de parent n'est
 * envoyé au lecteur. blockDepths est pur (testé) ; loadParentChain charge les parents en remontant (10 niveaux max).
 */
const MAX_DEPTH = 3;
const MAX_WALK = 50;

export function blockDepths(itemIds: string[], parentOf: Map<string, string | null>): Map<string, number> {
  const present = new Set(itemIds);
  const depths = new Map<string, number>();
  for (const id of itemIds) {
    let depth = 0;
    let current = parentOf.get(id) ?? null;
    const seen = new Set<string>([id]);
    for (let i = 0; current && i < MAX_WALK && !seen.has(current); i++) {
      seen.add(current);
      if (present.has(current)) depth++;
      current = parentOf.get(current) ?? null;
    }
    depths.set(id, Math.min(depth, MAX_DEPTH));
  }
  return depths;
}

/** parentId des éléments donnés et de leurs ancêtres (requêtes par niveau). */
export async function loadParentChain(prisma: any, itemIds: string[]): Promise<Map<string, string | null>> {
  const parentOf = new Map<string, string | null>();
  let frontier = [...new Set(itemIds)];
  for (let level = 0; frontier.length > 0 && level < 10; level++) {
    const rows: { id: string; parentId: string | null }[] = await prisma.item.findMany({
      where: { id: { in: frontier } },
      select: { id: true, parentId: true },
    });
    for (const r of rows) parentOf.set(r.id, r.parentId);
    frontier = [...new Set(rows.map((r) => r.parentId).filter((p): p is string => !!p && !parentOf.has(p)))];
  }
  return parentOf;
}

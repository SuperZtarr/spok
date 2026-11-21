/*
 * withProcessCounts — ajoute processCount (nombre d'éléments de type PROCESS de l'espace) à une liste d'espaces, en une
 * seule requête groupée. Sert l'indicateur « process » de la barre latérale (GET /spaces). Remplace depuis le
 * 2026-11-21 processNodeCount (places du process unique de l'espace, modèle abandonné).
 * Usage : envelopper la liste déjà construite ; ne modifie pas les autres champs.
 */
export async function withProcessCounts<T extends { id: string }>(prisma: any, spaces: T[]): Promise<(T & { processCount: number })[]> {
  if (spaces.length === 0) return [];
  const groups: { spaceId: string; _count: { _all: number } }[] = (await prisma.item.groupBy({
    by: ['spaceId'],
    where: { type: 'PROCESS', spaceId: { in: spaces.map((s) => s.id) } },
    _count: { _all: true },
  })) ?? [];
  const bySpace = new Map(groups.map((g) => [g.spaceId, g._count._all]));
  return spaces.map((s) => ({ ...s, processCount: bySpace.get(s.id) ?? 0 }));
}

/* Parcours en largeur des relations 'drives' ("Entraîne") — utilisé pour détecter un cycle à la
 * création d'un lien (item-relations.ts) et pour revalider les dépendants confirmés côté serveur
 * avant d'appliquer un décalage en cascade (item-cascade-shift.ts). */
import type { PrismaClient } from '@spok/database';

export async function getDrivesReachableIds(prisma: PrismaClient, startId: string): Promise<Set<string>> {
  const visited = new Set<string>();
  let frontier = [startId];

  while (frontier.length > 0) {
    const edges = await prisma.itemRelation.findMany({
      where: { type: 'drives', fromItemId: { in: frontier } },
      select: { toItemId: true },
    });

    const nextFrontier: string[] = [];
    for (const edge of edges) {
      if (!visited.has(edge.toItemId) && edge.toItemId !== startId) {
        visited.add(edge.toItemId);
        nextFrontier.push(edge.toItemId);
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}

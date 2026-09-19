/* Parcours en largeur des descendants d'un item (parentId) — sert à revalider côté serveur les
 * enfants confirmés dans la cascade de déplacement (item-cascade-shift.ts), en complément des
 * relations 'drives' (drivesGraph.ts). */
import type { PrismaClient } from '@spok/database';

export async function getDescendantIds(prisma: PrismaClient, anchorId: string): Promise<Set<string>> {
  const visited = new Set<string>();
  let frontier = [anchorId];

  while (frontier.length > 0) {
    const children = await prisma.item.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });

    const nextFrontier: string[] = [];
    for (const child of children) {
      if (!visited.has(child.id) && child.id !== anchorId) {
        visited.add(child.id);
        nextFrontier.push(child.id);
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}

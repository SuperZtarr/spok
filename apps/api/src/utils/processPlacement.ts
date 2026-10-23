/*
 * Transfert de la place des éléments dans la vue Process quand ils changent d'espace (déplacement groupé
 * item-move.ts, conversion en espace item-convert.ts). Positions (process_nodes) et couloirs (process_lanes) sont
 * enregistrés par espace : sans ce transfert, le process restait sur l'ancien espace (vue vide) et les éléments
 * arrivaient sans mise en page (incident prod 2026-10-22, « D&D5 Manu - Rodrigue » → « PJ Rodrigue »).
 * moveProcessPlacement(tx, itemIds, fromSpaceId, toSpaceId) — à appeler DANS la transaction du déplacement :
 * - couloirs dont l'élément part : suivent, même position ;
 * - positions des éléments qui partent : suivent, mêmes x / y ; couloir resté sur place → élément libre (laneId null) ;
 * - positions restées sur place dont le couloir part : libres (comme à la suppression d'un couloir) ;
 * - place déjà présente dans l'espace d'arrivée pour un de ces éléments : remplacée par celle qui arrive.
 * Règle businessRules « process-placement-follows-move ».
 */
import type { PrismaClient, Prisma } from '@spok/database';

type Db = PrismaClient | Prisma.TransactionClient;

export async function moveProcessPlacement(db: Db, itemIds: string[], fromSpaceId: string, toSpaceId: string): Promise<void> {
  if (itemIds.length === 0 || fromSpaceId === toSpaceId) return;

  const movingLanes = await db.processLane.findMany({
    where: { spaceId: fromSpaceId, itemId: { in: itemIds } },
    select: { id: true },
  });
  const movingLaneIds = movingLanes.map((l) => l.id);

  // Liens couloir ↔ élément coupés par le déplacement : l'élément devient libre de chaque côté
  if (movingLaneIds.length > 0) {
    await db.processNode.updateMany({
      where: { spaceId: fromSpaceId, laneId: { in: movingLaneIds }, itemId: { notIn: itemIds } },
      data: { laneId: null },
    });
  }
  await db.processNode.updateMany({
    where: { spaceId: fromSpaceId, itemId: { in: itemIds }, laneId: { not: null, notIn: movingLaneIds } },
    data: { laneId: null },
  });

  // Place déjà présente à l'arrivée (unicité espace + élément) : remplacée par celle qui arrive
  await db.processNode.deleteMany({ where: { spaceId: toSpaceId, itemId: { in: itemIds } } });
  await db.processLane.deleteMany({ where: { spaceId: toSpaceId, itemId: { in: itemIds } } });

  if (movingLaneIds.length > 0) {
    await db.processLane.updateMany({ where: { id: { in: movingLaneIds } }, data: { spaceId: toSpaceId } });
  }
  await db.processNode.updateMany({
    where: { spaceId: fromSpaceId, itemId: { in: itemIds } },
    data: { spaceId: toSpaceId },
  });
}

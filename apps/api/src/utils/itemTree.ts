/*
 * Création récursive d'une arborescence d'items à partir d'une structure { title, type, children }.
 * Utilisé par la création d'espace depuis un SPACE_TEMPLATE (spaces.ts) et par
 * POST /spaces/:spaceId/items/from-template (item-templates). Ne pose ni statut, ni dates,
 * ni tags — structure pure (titre+type).
 */
import type { PrismaClient, Item } from '@spok/database';
import type { ItemType } from '@spok/shared';

export interface ItemTreeNode {
  title: string;
  type: ItemType;
  children?: ItemTreeNode[];
}

export async function createItemTree(
  prisma: PrismaClient,
  nodes: ItemTreeNode[],
  params: { spaceId: string; createdById: string; parentId: string | null }
): Promise<Item[]> {
  const created: Item[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const item = await prisma.item.create({
      data: {
        title: node.title,
        type: node.type,
        spaceId: params.spaceId,
        createdById: params.createdById,
        parentId: params.parentId,
        position: i,
      },
    });
    created.push(item);
    if (node.children && node.children.length > 0) {
      await createItemTree(prisma, node.children, { ...params, parentId: item.id });
    }
  }
  return created;
}

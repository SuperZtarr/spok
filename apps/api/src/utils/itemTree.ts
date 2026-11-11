/*
 * Création récursive d'une arborescence d'items à partir d'une structure { title, type, children }.
 * Utilisé par la création d'espace depuis un SPACE_TEMPLATE (spaces.ts) et par
 * POST /spaces/:spaceId/items/from-template (item-templates). Ne pose ni statut, ni dates — structure (titre+type)
 * Un modèle enregistré avant le lot 4 peut citer un type retiré (BUG, DOCUMENT…) : remplacé à la volée
 * (replacementForRetiredType, tag compris) au lieu d'échouer. Et, au besoin, tags de classement (`tags`, ex. « bug » : tag de la communauté créé s'il manque, utils/classificationTag.ts).
 */
import type { PrismaClient, Item } from '@spok/database';
import { isRetiredItemType, replacementForRetiredType, type ItemType } from '@spok/shared';
import { ensureTag } from './classificationTag.js';

export interface ItemTreeNode {
  title: string;
  type: ItemType;
  tags?: string[];
  children?: ItemTreeNode[];
}

/** Ancien type d'un modèle enregistré → type actuel (+ tag de classement) ; autres nœuds inchangés */
function withCurrentType(node: ItemTreeNode): ItemTreeNode {
  const type = node.type as string;
  if (!isRetiredItemType(type)) return node;
  const next = replacementForRetiredType(type);
  return { ...node, type: next.type, tags: next.tag ? [...(node.tags ?? []), next.tag] : node.tags };
}

export async function createItemTree(
  prisma: PrismaClient,
  nodes: ItemTreeNode[],
  params: { spaceId: string; createdById: string; parentId: string | null }
): Promise<Item[]> {
  const created: Item[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = withCurrentType(nodes[i]);
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
    for (const name of node.tags ?? []) {
      const tagId = await ensureTag(prisma, params.spaceId, name);
      await prisma.itemTag.create({ data: { itemId: item.id, tagId } });
    }
    if (node.children && node.children.length > 0) {
      await createItemTree(prisma, node.children, { ...params, parentId: item.id });
    }
  }
  return created;
}

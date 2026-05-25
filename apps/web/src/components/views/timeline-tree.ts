import type { Item } from '@spok/shared';

export interface TreeItem extends Item {
  children: TreeItem[];
  depth: number;
}

export function buildTree(
  items: Item[],
  sortFn?: (a: TreeItem, b: TreeItem) => number,
): TreeItem[] {
  const itemMap = new Map<string, TreeItem>();
  const rootItems: TreeItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [], depth: 0 });
  });

  items.forEach(item => {
    const treeItem = itemMap.get(item.id)!;
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      parent.children.push(treeItem);
    } else {
      rootItems.push(treeItem);
    }
  });

  const defaultSort = (a: TreeItem, b: TreeItem) => (a.position ?? 0) - (b.position ?? 0);
  const compareFn = sortFn ?? defaultSort;

  function setDepths(items: TreeItem[], depth: number) {
    items.sort(compareFn);
    items.forEach(item => {
      item.depth = depth;
      setDepths(item.children, depth + 1);
    });
  }
  setDepths(rootItems, 0);

  return rootItems;
}

export function itemHasDate(item: Item): boolean {
  return !!(item.startDate || item.endDate || item.dueDate);
}

export function subtreeHasDate(item: TreeItem): boolean {
  if (itemHasDate(item)) return true;
  return item.children.some(child => subtreeHasDate(child));
}

export function flattenTree(items: TreeItem[], collapsedIds: Set<string>, compactMode: boolean = false): TreeItem[] {
  const result: TreeItem[] = [];

  function traverse(items: TreeItem[]) {
    items.forEach(item => {
      // In compact mode, skip items that have no dates in their entire subtree
      if (compactMode && !subtreeHasDate(item)) return;

      result.push(item);
      if (item.children.length > 0 && !collapsedIds.has(item.id)) {
        traverse(item.children);
      }
    });
  }

  traverse(items);
  return result;
}

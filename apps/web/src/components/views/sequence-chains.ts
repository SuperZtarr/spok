import type { Item, ItemRelation } from '@spok/shared';

export interface ConnectorEdge {
  from: string;
  to: string;
  type: 'depends' | 'blocks' | 'hierarchy' | 'relates' | 'duplicates' | 'implements' | 'tests';
}

export interface Chain {
  levels: Item[][];          // items grouped by depth (column), left to right
  edges: ConnectorEdge[];    // all edges: hierarchy + relations within this chain
}

/**
 * Build branches from parent-child hierarchy, with relations affecting positioning.
 *
 * Step 1: Compute levels GLOBALLY across all items (hierarchy + relations combined).
 *         If C blocks A, A is pushed after C even if they're in different subtrees.
 * Step 2: Split into branches per root (first child continues, others fork).
 * Step 3: Each branch = one horizontal line with items at their global level.
 */
export function computeHierarchyChains(
  items: Item[],
  relations: ItemRelation[]
): { chains: Chain[]; standalone: Item[] } {
  const itemMap = new Map(items.map(i => [i.id, i]));
  const itemIds = new Set(items.map(i => i.id));

  // Build children map
  const childrenMap = new Map<string, Item[]>();
  const roots: Item[] = [];

  items.forEach(item => {
    if (!item.parentId || !itemMap.has(item.parentId)) {
      roots.push(item);
    } else {
      if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
      childrenMap.get(item.parentId)!.push(item);
    }
  });

  // Sort roots and children by position
  roots.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const [, children] of childrenMap) {
    children.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // --- Step 1: Compute levels GLOBALLY (all items, all edges) ---
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const dagEdgeSet = new Set<string>();
  const allHierarchyEdges: { from: string; to: string }[] = [];
  const allRelEdges: ConnectorEdge[] = [];

  items.forEach(item => {
    successors.set(item.id, []);
    inDegree.set(item.id, 0);
  });

  // Add all hierarchy edges (parent → child)
  items.forEach(item => {
    if (item.parentId && itemMap.has(item.parentId)) {
      const key = `${item.parentId}→${item.id}`;
      if (!dagEdgeSet.has(key)) {
        dagEdgeSet.add(key);
        successors.get(item.parentId)!.push(item.id);
        inDegree.set(item.id, (inDegree.get(item.id) || 0) + 1);
        allHierarchyEdges.push({ from: item.parentId, to: item.id });
      }
    }
  });

  // Add all relation edges
  relations.forEach(rel => {
    if (!itemIds.has(rel.fromItemId) || !itemIds.has(rel.toItemId)) return;

    let from: string, to: string;
    if (rel.type === 'depends') {
      from = rel.toItemId;
      to = rel.fromItemId;
    } else {
      // blocks, relates, duplicates, implements, tests — all go from → to
      from = rel.fromItemId;
      to = rel.toItemId;
    }

    allRelEdges.push({ from, to, type: rel.type as ConnectorEdge['type'] });

    const key = `${from}→${to}`;
    if (!dagEdgeSet.has(key)) {
      dagEdgeSet.add(key);
      successors.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  });

  // Compute levels via longest path (Kahn's algorithm)
  const level = new Map<string, number>();
  items.forEach(item => level.set(item.id, 0));

  const topoQueue: string[] = [];
  items.forEach(item => {
    if ((inDegree.get(item.id) || 0) === 0) topoQueue.push(item.id);
  });

  while (topoQueue.length > 0) {
    const id = topoQueue.shift()!;
    for (const s of successors.get(id) || []) {
      level.set(s, Math.max(level.get(s)!, level.get(id)! + 1));
      const deg = (inDegree.get(s) || 0) - 1;
      inDegree.set(s, deg);
      if (deg === 0) topoQueue.push(s);
    }
  }

  // Handle cycles
  const maxLevel = Math.max(...Array.from(level.values()), 0);
  items.forEach(item => {
    if ((inDegree.get(item.id) || 0) > 0) level.set(item.id, maxLevel + 1);
  });

  const globalMaxLevel = Math.max(...Array.from(level.values()), 0);

  // --- Step 2: Extract branches per root via DFS ---
  const allChains: Chain[] = [];
  const assignedIds = new Set<string>();

  roots.forEach(root => {
    // Collect all descendants of this root
    const subtreeIds = new Set<string>();
    const collectQueue = [root];
    while (collectQueue.length > 0) {
      const item = collectQueue.shift()!;
      subtreeIds.add(item.id);
      assignedIds.add(item.id);
      const children = childrenMap.get(item.id) || [];
      children.forEach(child => {
        if (!subtreeIds.has(child.id)) collectQueue.push(child);
      });
    }

    // DFS to extract branches
    const branches: Item[][] = [];

    function dfs(node: Item, currentBranch: Item[]) {
      currentBranch.push(node);
      const children = childrenMap.get(node.id) || [];

      if (children.length === 0) {
        branches.push([...currentBranch]);
      } else {
        dfs(children[0], currentBranch);
        for (let i = 1; i < children.length; i++) {
          dfs(children[i], []);
        }
      }
    }

    dfs(root, []);

    // Convert branches to Chains
    branches.forEach(branchItems => {
      const branchIds = new Set(branchItems.map(i => i.id));

      // Build levels array with global alignment
      const levels: Item[][] = Array.from({ length: globalMaxLevel + 1 }, () => []);
      branchItems.forEach(item => {
        levels[level.get(item.id)!].push(item);
      });

      // Remove trailing empty levels
      while (levels.length > 0 && levels[levels.length - 1].length === 0) {
        levels.pop();
      }

      // Build edges within this branch
      const branchEdges: ConnectorEdge[] = [];
      allHierarchyEdges.forEach(e => {
        if (branchIds.has(e.from) && branchIds.has(e.to)) {
          branchEdges.push({ from: e.from, to: e.to, type: 'hierarchy' });
        }
      });
      allRelEdges.forEach(e => {
        if (branchIds.has(e.from) && branchIds.has(e.to)) {
          branchEdges.push(e);
        }
      });

      allChains.push({ levels, edges: branchEdges });
    });
  });

  // Handle orphan items
  const orphans = items.filter(i => !assignedIds.has(i.id));
  orphans.forEach(item => {
    const levels: Item[][] = Array.from({ length: (level.get(item.id) || 0) + 1 }, () => []);
    levels[level.get(item.id) || 0] = [item];
    allChains.push({ levels, edges: [] });
    assignedIds.add(item.id);
  });

  // Separate: branches with >1 item or edges vs standalone single items
  const multiChains: Chain[] = [];
  const standaloneItems: Item[] = [];

  allChains.forEach(chain => {
    const totalItems = chain.levels.reduce((s, l) => s + l.length, 0);
    if (totalItems > 1 || chain.edges.length > 0) {
      multiChains.push(chain);
    } else {
      const firstItem = chain.levels.find(l => l.length > 0)?.[0];
      if (firstItem) standaloneItems.push(firstItem);
    }
  });

  return { chains: multiChains, standalone: standaloneItems };
}

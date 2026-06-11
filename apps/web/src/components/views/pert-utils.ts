import type { Item, ItemRelation } from '@spok/shared';

export interface PertGraph {
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
}

export function buildPertGraph(items: Item[], relations: ItemRelation[]): PertGraph {
  const itemSet = new Set(items.map(i => i.id));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const item of items) {
    predecessors.set(item.id, []);
    successors.set(item.id, []);
  }

  for (const rel of relations) {
    const from = rel.fromItemId;
    const to = rel.toItemId;
    if (!itemSet.has(from) || !itemSet.has(to)) continue;
    if (rel.type !== 'blocks' && rel.type !== 'implements') continue;

    // blocks / implements: from → to means from is predecessor of to
    predecessors.get(to)!.push(from);
    successors.get(from)!.push(to);
  }

  return { predecessors, successors };
}

export function computePertRanks(
  items: Item[],
  predecessors: Map<string, string[]>,
  successors: Map<string, string[]>,
): Map<string, number> {
  const ranks = new Map<string, number>();

  // Kahn's topological sort
  const inDegree = new Map<string, number>();
  for (const item of items) {
    inDegree.set(item.id, predecessors.get(item.id)!.length);
  }

  const queue: string[] = [];
  for (const item of items) {
    if (inDegree.get(item.id) === 0) {
      queue.push(item.id);
      ranks.set(item.id, 0);
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curRank = ranks.get(cur)!;
    for (const succ of (successors.get(cur) ?? [])) {
      const newRank = curRank + 1;
      if (!ranks.has(succ) || ranks.get(succ)! < newRank) {
        ranks.set(succ, newRank);
      }
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  // Items not reached (cycle or isolated): rank 0
  for (const item of items) {
    if (!ranks.has(item.id)) ranks.set(item.id, 0);
  }

  return ranks;
}

export function computeCriticalPathNaive(
  items: Item[],
  predecessors: Map<string, string[]>,
  successors: Map<string, string[]>,
): Set<string> {
  // Only items that have at least one dependency edge participate
  const connected = items.filter(
    i => (predecessors.get(i.id)?.length ?? 0) > 0 || (successors.get(i.id)?.length ?? 0) > 0
  );
  if (connected.length === 0) return new Set();

  const connectedIds = new Set(connected.map(i => i.id));

  // Forward pass: ES[v] = max(EF[predecessors]), EF[v] = ES[v] + 1
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  // Topological order via Kahn on connected subgraph
  const inDegree = new Map<string, number>();
  for (const item of connected) {
    inDegree.set(item.id, predecessors.get(item.id)!.filter(p => connectedIds.has(p)).length);
  }

  const queue: string[] = [];
  for (const item of connected) {
    if (inDegree.get(item.id) === 0) queue.push(item.id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    topoOrder.push(cur);
    for (const succ of (successors.get(cur) ?? []).filter(s => connectedIds.has(s))) {
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  if (topoOrder.length !== connected.length) return new Set(); // cycle

  for (const id of topoOrder) {
    const preds = predecessors.get(id)!.filter(p => connectedIds.has(p));
    const es = preds.length === 0 ? 0 : Math.max(...preds.map(p => EF.get(p) ?? 0));
    ES.set(id, es);
    EF.set(id, es + 1);
  }

  // Backward pass
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();

  for (const id of [...topoOrder].reverse()) {
    const succs = (successors.get(id) ?? []).filter(s => connectedIds.has(s));
    const lf = succs.length === 0 ? EF.get(id)! : Math.min(...succs.map(s => LS.get(s) ?? Infinity));
    LF.set(id, lf);
    LS.set(id, lf - 1);
  }

  const critical = new Set<string>();
  for (const id of topoOrder) {
    if ((LS.get(id) ?? 0) === (ES.get(id) ?? 0)) critical.add(id);
  }

  return critical;
}

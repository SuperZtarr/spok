/*
 * Règles du glisser-déposer d'un espace sur la carte mentale globale (DashboardMindMapView) — module pur, testé.
 * resolveSpaceDrop(tree, draggedId, targetId) dit ce que produirait le dépôt du nœud draggedId sur targetId :
 *  - null      : rien à faire (pas un espace, même nœud, déjà à cet endroit) → simple repositionnement visuel ;
 *  - 'move'    : PATCH /spaces/:id { parentId, communityId? } + libellé affiché pendant le survol ;
 *  - 'invalid' : dépôt refusé, avec la raison affichée pendant le survol (cible en rouge).
 * Les ids sont ceux des nœuds de la carte (space-…, community-…, personal, independent) ; entityId = id réel.
 * Garde-fous alignés sur PATCH /spaces/:id : espace personnel jamais imbriqué ni rattaché, parent = espace de groupe,
 * pas de cycle. Changer de communauté un espace qui a des sous-espaces est permis : l'API embarque les
 * descendants dans la nouvelle communauté (même transaction).
 */

export interface DropTreeNode {
  id: string;
  name: string;
  type: 'central' | 'community' | 'personal-group' | 'independent-group' | 'space';
  entityId?: string;
  children: DropTreeNode[];
}

export type SpaceDropResult =
  | { kind: 'move'; spaceId: string; parentId: string | null; communityId?: string | null; label: string }
  | { kind: 'invalid'; label: string };

interface Located {
  node: DropTreeNode;
  parent: DropTreeNode | null;
  /** Nœud de regroupement (communauté, personnels, indépendants) auquel appartient le nœud. */
  group: DropTreeNode | null;
}

function locate(root: DropTreeNode, id: string): Located | null {
  const walk = (node: DropTreeNode, parent: DropTreeNode | null, group: DropTreeNode | null): Located | null => {
    const ownGroup = node.type === 'space' ? group : node.type === 'central' ? null : node;
    if (node.id === id) return { node, parent, group: node.type === 'space' ? group : null };
    for (const child of node.children) {
      const found = walk(child, node, ownGroup);
      if (found) return found;
    }
    return null;
  };
  return walk(root, null, null);
}

function contains(node: DropTreeNode, id: string): boolean {
  return node.children.some(c => c.id === id || contains(c, id));
}

export function resolveSpaceDrop(root: DropTreeNode, draggedId: string, targetId: string): SpaceDropResult | null {
  if (draggedId === targetId) return null;
  const dragged = locate(root, draggedId);
  const target = locate(root, targetId);
  if (!dragged || !target) return null;
  const d = dragged.node;
  const t = target.node;
  if (d.type !== 'space' || !d.entityId || t.type === 'central') return null;

  // Déjà là : déposer sur son parent actuel ne change rien
  if (dragged.parent?.id === t.id) return null;

  const draggedIsPersonal = dragged.group?.type === 'personal-group';
  const targetIsPersonal = t.type === 'personal-group' || target.group?.type === 'personal-group';
  if (draggedIsPersonal) {
    return { kind: 'invalid', label: 'Impossible : un espace personnel ne se déplace pas' };
  }
  if (targetIsPersonal) {
    return { kind: 'invalid', label: 'Impossible : les espaces personnels ne reçoivent pas d\'espace' };
  }
  if (contains(d, t.id)) {
    return { kind: 'invalid', label: `Impossible : « ${t.name} » est un sous-espace de « ${d.name} »` };
  }

  // Communauté de destination : celle de la cible (communauté, ou groupe de l'espace cible)
  const destGroup = t.type === 'space' ? target.group : t;
  const changesCommunity = destGroup?.id !== dragged.group?.id;

  if (t.type === 'space') {
    if (!t.entityId) return null;
    return { kind: 'move', spaceId: d.entityId, parentId: t.entityId, label: `Déplacer dans « ${t.name} »` };
  }
  if (t.type === 'community') {
    if (!t.entityId) return null;
    return changesCommunity
      ? { kind: 'move', spaceId: d.entityId, parentId: null, communityId: t.entityId, label: `Rattacher à la communauté « ${t.name} »` }
      : { kind: 'move', spaceId: d.entityId, parentId: null, label: `Placer à la racine de « ${t.name} »` };
  }
  // independent-group
  return changesCommunity
    ? { kind: 'move', spaceId: d.entityId, parentId: null, communityId: null, label: 'Rendre indépendant (sans communauté)' }
    : { kind: 'move', spaceId: d.entityId, parentId: null, label: 'Placer à la racine des espaces indépendants' };
}

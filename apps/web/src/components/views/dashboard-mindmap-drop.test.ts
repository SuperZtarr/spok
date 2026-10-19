/* Tests des règles de dépôt d'un espace sur la carte mentale globale (resolveSpaceDrop). */
import { describe, it, expect } from 'vitest';
import { resolveSpaceDrop, type DropTreeNode } from './dashboard-mindmap-drop';

const sp = (key: string, name: string, children: DropTreeNode[] = []): DropTreeNode =>
  ({ id: `space-${key}`, name, type: 'space', entityId: key, children });

// root
// ├─ personal : Perso
// ├─ community-A : A1 (→ A1a), A2
// ├─ community-B : B1
// └─ independent : I1
const tree: DropTreeNode = {
  id: 'root', name: 'SPOK', type: 'central', children: [
    { id: 'personal', name: 'Espaces personnels', type: 'personal-group', children: [sp('perso', 'Perso')] },
    { id: 'community-A', name: 'Comm A', type: 'community', entityId: 'A', children: [sp('a1', 'A1', [sp('a1a', 'A1a')]), sp('a2', 'A2')] },
    { id: 'community-B', name: 'Comm B', type: 'community', entityId: 'B', children: [sp('b1', 'B1')] },
    { id: 'independent', name: 'Espaces indépendants', type: 'independent-group', children: [sp('i1', 'I1')] },
  ],
};

describe('resolveSpaceDrop', () => {
  it('ne fait rien sur soi-même, sur son parent actuel ou pour un nœud qui n\'est pas un espace', () => {
    expect(resolveSpaceDrop(tree, 'space-a2', 'space-a2')).toBeNull();
    expect(resolveSpaceDrop(tree, 'space-a1a', 'space-a1')).toBeNull();
    expect(resolveSpaceDrop(tree, 'space-a2', 'community-A')).toBeNull();
    expect(resolveSpaceDrop(tree, 'community-A', 'community-B')).toBeNull();
  });

  it('déplace dans un espace de la même communauté', () => {
    expect(resolveSpaceDrop(tree, 'space-a2', 'space-a1')).toEqual({ kind: 'move', spaceId: 'a2', parentId: 'a1', label: 'Déplacer dans « A1 »' });
  });

  it('remonte un sous-espace à la racine de sa communauté sans toucher à la communauté', () => {
    expect(resolveSpaceDrop(tree, 'space-a1a', 'community-A')).toEqual({ kind: 'move', spaceId: 'a1a', parentId: null, label: 'Placer à la racine de « Comm A »' });
  });

  it('rattache à une autre communauté (communityId envoyé)', () => {
    expect(resolveSpaceDrop(tree, 'space-a2', 'community-B')).toMatchObject({ kind: 'move', parentId: null, communityId: 'B' });
    expect(resolveSpaceDrop(tree, 'space-a2', 'space-b1')).toMatchObject({ kind: 'move', parentId: 'b1' });
    expect(resolveSpaceDrop(tree, 'space-a2', 'independent')).toMatchObject({ kind: 'move', parentId: null, communityId: null });
  });

  it('refuse de déposer un espace dans un de ses sous-espaces', () => {
    expect(resolveSpaceDrop(tree, 'space-a1', 'space-a1a')).toMatchObject({ kind: 'invalid' });
  });

  it('refuse tout déplacement impliquant les espaces personnels', () => {
    expect(resolveSpaceDrop(tree, 'space-perso', 'space-a1')).toMatchObject({ kind: 'invalid' });
    expect(resolveSpaceDrop(tree, 'space-a2', 'space-perso')).toMatchObject({ kind: 'invalid' });
    expect(resolveSpaceDrop(tree, 'space-a2', 'personal')).toMatchObject({ kind: 'invalid' });
  });

  it('change de communauté un espace qui a des sous-espaces (l\'API les embarque)', () => {
    expect(resolveSpaceDrop(tree, 'space-a1', 'community-B')).toMatchObject({ kind: 'move', spaceId: 'a1', parentId: null, communityId: 'B' });
    expect(resolveSpaceDrop(tree, 'space-a1', 'space-i1')).toMatchObject({ kind: 'move', spaceId: 'a1', parentId: 'i1' });
    expect(resolveSpaceDrop(tree, 'space-a1', 'space-a2')).toMatchObject({ kind: 'move', parentId: 'a2' });
  });
});

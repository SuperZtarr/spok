/* TNR de mindmap-layout — withCurrentCallbacks : actions des nœuds rafraîchies sans reconstruire la carte. */
import { describe, it, expect } from 'vitest';
import { withCurrentCallbacks, type MindMapCallbacks } from './mindmap-layout';

const noop = () => {};
const makeCallbacks = (onDelete: (id: string) => void): MindMapCallbacks => ({
  onEdit: noop, onDelete, onUpdateStatus: noop, onAddChild: noop, onAddPortal: noop,
  onToggleCollapse: noop, onReorganizeChildren: noop,
});

describe('withCurrentCallbacks', () => {
  it('remplace une action périmée (bug : onDelete comptait les enfants sur une liste ancienne)', () => {
    const oldDelete = () => {};
    const newDelete = () => {};
    const data = { label: 'P', childCount: 3, onDelete: oldDelete, onEdit: noop };
    const next = withCurrentCallbacks(data, makeCallbacks(newDelete));
    expect(next.onDelete).toBe(newDelete);
    expect(next.label).toBe('P');
    expect(next.childCount).toBe(3);
  });

  it("n'ajoute pas d'action absente des données (nœud portail, espace…)", () => {
    const data = { space: { id: 's' }, onRemove: noop };
    expect(withCurrentCallbacks(data, makeCallbacks(noop))).toBe(data);
  });

  it('renvoie le même objet si rien ne change (pas de rendu inutile)', () => {
    const cbs = makeCallbacks(noop);
    const data = { onDelete: cbs.onDelete, onEdit: cbs.onEdit };
    expect(withCurrentCallbacks(data, cbs)).toBe(data);
  });

  it('onTogglePin absent des callbacks : garde le repli existant', () => {
    const fallback = () => {};
    const data = { onTogglePin: fallback };
    expect(withCurrentCallbacks(data, makeCallbacks(noop))).toBe(data);
  });
});

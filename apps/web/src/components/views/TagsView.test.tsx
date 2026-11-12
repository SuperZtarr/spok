/* Tests de la vue Tags (2026-11-11, refonte) : règle de dépôt d'une carte, colonnes = tous les tags proposés,
   palette globaux puis communauté, cibles d'un geste (élément seul ou sélection), rendu, × et barre de sélection. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Item, Tag } from '@spok/shared';
import { buildTagColumns, NO_TAG_COLUMN, splitPalette, TagsView, tagsAfterDrop, targetsOf } from './TagsView';

const bug = { id: 'bug', name: 'bug', color: '#ef4444', isGlobalTag: true } as Tag & { isGlobalTag: boolean };
const ux = { id: 'ux', name: 'UX', color: null, isGlobalTag: false } as Tag & { isGlobalTag: boolean };
const perf = { id: 'perf', name: 'perf', color: null, isGlobalTag: false } as Tag & { isGlobalTag: boolean };
const old = { id: 'old', name: 'ancien', color: null } as Tag;

const item = (id: string, tags: Tag[]): Item =>
  ({ id, title: `Élément ${id}`, type: 'TASK', status: null, spaceId: 's1', tags, createdAt: '', updatedAt: '' }) as unknown as Item;

describe('tagsAfterDrop', () => {
  it('colonne de tag : ajoute le tag, garde les autres', () => {
    expect(tagsAfterDrop([bug], 'bug', 'ux', ux)).toEqual([bug, ux]);
    expect(tagsAfterDrop([], NO_TAG_COLUMN, 'ux', ux)).toEqual([ux]);
  });
  it('« Sans tag » : retire le tag de la colonne d\'origine', () => {
    expect(tagsAfterDrop([bug, ux], 'bug', NO_TAG_COLUMN)).toEqual([ux]);
  });
  it('rien à changer : même colonne, tag déjà porté, « Sans tag » vers « Sans tag »', () => {
    expect(tagsAfterDrop([bug], 'bug', 'bug', bug)).toBeNull();
    expect(tagsAfterDrop([bug, ux], 'bug', 'ux', ux)).toBeNull();
    expect(tagsAfterDrop([], NO_TAG_COLUMN, NO_TAG_COLUMN)).toBeNull();
  });
});

describe('colonnes, palette, cibles', () => {
  it('colonnes : tous les tags proposés, même non portés, plus un tag porté hors propositions, triés', () => {
    expect(buildTagColumns([item('a', [old])], [ux, bug, perf]).map((t) => t.id)).toEqual(['old', 'bug', 'perf', 'ux']);
  });
  it('palette : globaux, communauté, puis espace (tags de l\'espace avant ceux hérités)', () => {
    const inherited = { id: 'h', name: 'a-hérité', color: null, scope: 'space', spaceId: 'parent', inherited: true } as Tag;
    const own = { id: 'o', name: 'z-ici', color: null, scope: 'space', spaceId: 'here', inherited: false } as Tag;
    const p = splitPalette([ux, inherited, bug, own, perf]);
    expect(p.map((g) => [g.label, g.tags.map((t) => t.id)])).toEqual([
      ['Globaux', ['bug']], ['Communauté', ['perf', 'ux']], ['Espace', ['o', 'h']],
    ]);
  });
  it('cibles : toute la sélection si l\'élément en fait partie, sinon lui seul', () => {
    expect(targetsOf('a', new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(targetsOf('c', new Set(['a', 'b']))).toEqual(['c']);
  });
});

describe('TagsView', () => {
  const noop = () => {};
  const base = { onEdit: noop, onDelete: noop, onUpdateStatus: noop, onAddChild: noop };

  it('une colonne par tag proposé, même vide ; « Masquer les tags vides » les retire', () => {
    render(<TagsView {...base} items={[item('a', [bug])]} tagOptions={[bug, ux]} onSetTags={vi.fn()} onBulkTags={vi.fn()} />);
    const headings = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings()).toEqual(['Sans tag', 'bug', 'UX']);
    fireEvent.click(screen.getByLabelText('Masquer les tags vides'));
    expect(headings()).toEqual(['Sans tag', 'bug']);
  });

  it('× retire le tag de la colonne ; la sélection propose d\'ajouter un tag à tous les cochés', () => {
    const onSetTags = vi.fn();
    const onBulkTags = vi.fn();
    render(<TagsView {...base} items={[item('a', [bug]), item('b', [])]} tagOptions={[bug, ux]} onSetTags={onSetTags} onBulkTags={onBulkTags} />);

    fireEvent.click(screen.getByLabelText("Retirer ce tag de l'élément"));
    expect(onSetTags).toHaveBeenCalledWith('a', []);

    for (const box of screen.getAllByLabelText("Sélectionner l'élément")) fireEvent.click(box);
    expect(screen.getByText('2 éléments sélectionnés')).toBeTruthy();
    fireEvent.click(screen.getByText('Ajouter un tag'));
    // La pastille de la palette (rôle bouton posé par dnd-kit) précède l'entrée du menu dans la page
    fireEvent.click(screen.getAllByRole('button', { name: 'UX' }).pop()!);
    const [ids, add] = onBulkTags.mock.calls[0];
    expect([...ids].sort()).toEqual(['a', 'b']);
    expect(add).toEqual([ux]);
  });

  it('lecture seule : ni palette, ni cases, ni ×', () => {
    render(<TagsView {...base} items={[item('a', [bug])]} tagOptions={[bug]} onSetTags={vi.fn()} onBulkTags={vi.fn()} canEdit={false} />);
    expect(screen.queryByLabelText("Retirer ce tag de l'élément")).toBeNull();
    expect(screen.queryByLabelText("Sélectionner l'élément")).toBeNull();
    expect(screen.queryByText('Globaux')).toBeNull();
  });
});

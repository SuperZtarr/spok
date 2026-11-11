/* Tests de la vue Tags (2026-11-11) : règle de dépôt (ajout sur une colonne de tag, retrait sur « Sans tag »),
   colonnes (tags portés + colonnes ajoutées, triées), rendu des colonnes et retrait par le bouton ×. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Item, Tag } from '@spok/shared';
import { buildTagColumns, NO_TAG_COLUMN, TagsView, tagsAfterDrop } from './TagsView';

const bug: Tag = { id: 'bug', name: 'bug', color: '#ef4444' } as Tag;
const ux: Tag = { id: 'ux', name: 'UX', color: null } as Tag;
const perf: Tag = { id: 'perf', name: 'perf', color: null } as Tag;

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

describe('buildTagColumns', () => {
  it('tags portés et colonnes ajoutées, sans doublon, triés par nom', () => {
    const cols = buildTagColumns([item('a', [ux, bug]), item('b', [bug])], [perf, bug]);
    expect(cols.map((t) => t.id)).toEqual(['bug', 'perf', 'ux']);
  });
});

describe('TagsView', () => {
  const noop = () => {};
  const base = { onEdit: noop, onDelete: noop, onUpdateStatus: noop, onAddChild: noop };

  it('« Sans tag » puis une colonne par tag ; × retire le tag de la colonne', () => {
    const onSetTags = vi.fn();
    render(<TagsView {...base} items={[item('a', [bug, ux]), item('b', [])]} tagOptions={[bug, ux, perf]} onSetTags={onSetTags} />);

    expect(screen.getByText('Sans tag')).toBeTruthy();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Sans tag', 'bug', 'UX']);
    // L'élément a est dans deux colonnes
    expect(screen.getAllByText('Élément a')).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText("Retirer ce tag de l'élément")[0]);
    expect(onSetTags).toHaveBeenCalledWith('a', [ux]);
  });

  it('lecture seule : ni ×, ni « + Colonne »', () => {
    render(<TagsView {...base} items={[item('a', [bug])]} tagOptions={[bug]} onSetTags={vi.fn()} canEdit={false} />);
    expect(screen.queryByLabelText("Retirer ce tag de l'élément")).toBeNull();
    expect(screen.queryByText('Colonne')).toBeNull();
  });
});

/* TNR du sélecteur à parcourir d'un article (ArticleBrowser) : espace de l'article choisi à l'ouverture, arbre,
 * sélection multiple dans l'ordre de l'arbre, éléments déjà présents grisés, onglet Processus, liste tronquée. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pageHint } from '../../help/pageHint';

const api = vi.hoisted(() => ({ browseSpaces: vi.fn(), browseItems: vi.fn(), candidates: vi.fn() }));
vi.mock('../../lib/api', () => ({ articlesApi: api }));

import { ArticleBrowser } from './ArticleBrowser';

const item = (id: string, parentId: string | null, position: number, type = 'NOTE') =>
  ({ id, type, title: `Titre ${id}`, status: null, statusLabel: null, parentId, position });

const show = (presentIds = new Set<string>()) => {
  const onAdd = vi.fn();
  const onAddProcess = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ArticleBrowser isOpen onClose={vi.fn()} spaceId="s1" articleId="art" presentIds={presentIds} onAdd={onAdd} onAddProcess={onAddProcess} />
    </QueryClientProvider>,
  );
  return { onAdd, onAddProcess };
};
const checkbox = (title: string) => screen.getByRole('checkbox', { name: title }) as HTMLInputElement;

describe('ArticleBrowser', () => {
  beforeEach(() => {
    api.browseSpaces.mockReset().mockResolvedValue([
      { spaceId: 's1', name: 'Espace un', parentId: null, communityName: 'C', itemCount: 3, process: { nodeCount: 2, lanes: [{ id: 'L1', title: 'Couloir A' }] } },
      { spaceId: 's2', name: 'Espace deux', parentId: null, communityName: 'C', itemCount: 1, process: null },
    ]);
    api.browseItems.mockReset().mockImplementation(async (_s: string, _a: string, browsed: string) => browsed === 's1'
      ? { items: [item('b', null, 1), item('a', null, 0), item('p', null, 2)], truncated: false }
      : { items: [item('z', null, 0)], truncated: true });
    api.candidates.mockReset().mockResolvedValue({ items: [] });
  });

  it('ouvre sur l’espace de l’article ; ajout de deux éléments dans l’ordre de l’arbre', async () => {
    const { onAdd } = show();
    await screen.findByText('Titre a');
    fireEvent.click(checkbox('Titre b'));
    fireEvent.click(checkbox('Titre a'));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter (2)' }));
    expect(onAdd).toHaveBeenCalledWith(['a', 'b'], { children: false, chain: false });
  });

  it('élément déjà présent : grisé, case désactivée', async () => {
    show(new Set(['p']));
    await screen.findByText('Titre p');
    expect(checkbox('Titre p').disabled).toBe(true);
    expect(screen.getByText('déjà ajouté')).toBeTruthy();
  });

  it('changer d’espace garde la sélection ; liste tronquée signalée', async () => {
    show();
    await screen.findByText('Titre a');
    fireEvent.click(checkbox('Titre a'));
    fireEvent.click(screen.getByRole('button', { name: /Espace deux/ }));
    await screen.findByText('Titre z');
    expect(screen.getByText(pageHint('article', 'browserTruncated')!)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter (1)' })).toBeTruthy();
  });

  it('onglet Processus : un couloir', async () => {
    const { onAddProcess } = show();
    await screen.findByText('Titre a');
    fireEvent.click(screen.getByRole('tab', { name: 'Processus' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Couloir A' }));
    await waitFor(() => expect(onAddProcess).toHaveBeenCalledWith({ kind: 'process', spaceId: 's1', laneId: 'L1' }));
  });

  it('aucun élément coché : Ajouter désactivé', async () => {
    show();
    await screen.findByText('Titre a');
    expect((screen.getByRole('button', { name: 'Ajouter (0)' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

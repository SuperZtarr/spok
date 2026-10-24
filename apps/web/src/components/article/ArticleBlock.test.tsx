/* TNR du rendu des blocs d'article par type (ArticleBlock) : intertitre, légende, ligne d'infos, icône du site,
 * fichier joint, bloc indisponible. */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ArticleBlockView } from '@spok/shared';
import { ArticleBlock } from './ArticleBlock';
import { blockMetaLine } from './articleBlockContent';

type BlockItem = NonNullable<ArticleBlockView['item']>;
const item = (over: Partial<BlockItem>): BlockItem => ({
  id: 'i', type: 'NOTE', title: 'Titre', description: null, url: null,
  status: null, statusLabel: null, priority: null, startDate: null, endDate: null, dueDate: null,
  canOpen: false, canEdit: false, spaceId: null, ...over,
});
const block = (it: BlockItem | null, available = true): ArticleBlockView => ({ id: 'b', position: 0, width: 'full', align: 'center', available, item: it });
const show = (b: ArticleBlockView, children?: React.ReactNode) => render(<MemoryRouter><ArticleBlock block={b}>{children}</ArticleBlock></MemoryRouter>);

describe('ArticleBlock', () => {
  it('note : intertitre puis texte ; vide : intertitre seul ; en Composer : un seul texte', () => {
    const { unmount } = show(block(item({ title: 'Ma note', description: '<p>Le texte</p>' })));
    expect(screen.getByRole('heading', { name: 'Ma note' })).toBeTruthy();
    expect(screen.getByText('Le texte')).toBeTruthy();
    unmount();

    const empty = show(block(item({ title: 'Vide' })));
    expect(screen.getByRole('heading', { name: 'Vide' })).toBeTruthy();
    empty.unmount();

    show(block(item({ title: 'Éditée', description: '<p>Ancien</p>' })), <div>Éditeur</div>);
    expect(screen.getByRole('heading', { name: 'Éditée' })).toBeTruthy();
    expect(screen.getByText('Éditeur')).toBeTruthy();
    expect(screen.queryByText('Ancien')).toBeNull();
  });

  it('image : légende = titre + description', () => {
    const { container } = show(block(item({ type: 'IMAGE', title: 'Carte', description: '<p>Vue du nord</p>', url: 'https://r2/c.webp' })));
    const caption = container.querySelector('figcaption')!;
    expect(caption.textContent).toContain('Carte');
    expect(caption.textContent).toContain('Vue du nord');
  });

  it('tâche : ligne d’infos', () => {
    const it = item({ type: 'TASK', title: 'Livrer', statusLabel: 'À faire', priority: 4 });
    show(block(it));
    expect(screen.getByText(blockMetaLine(it)!)).toBeTruthy();
  });

  it('lien : icône du site, repli si elle ne charge pas', () => {
    const { container } = show(block(item({ type: 'LINK', title: 'Exemple', url: 'https://exemple.org/page' })));
    const icon = container.querySelector('img[src="https://exemple.org/favicon.ico"]')!;
    expect(icon).toBeTruthy();
    fireEvent.error(icon);
    expect(container.querySelector('img[src="https://exemple.org/favicon.ico"]')).toBeNull();
    expect(container.querySelector('[data-fallback-icon]')).toBeTruthy();
  });

  it('document : lien nommé d’après le fichier', () => {
    show(block(item({ type: 'DOCUMENT', title: 'Rapport', url: 'https://r2/docs/1729000000000-rapport.pdf' })));
    expect(screen.getByRole('link', { name: /rapport\.pdf/ })).toBeTruthy();
  });

  it('bloc indisponible : encart, aucun contenu', () => {
    const { container } = show(block(null, false));
    expect(container.textContent).toContain('indisponible');
  });
});

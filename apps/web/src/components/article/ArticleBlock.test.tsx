/* TNR du rendu des blocs d'article selon les contenus de l'élément (ArticleBlock, lot 3a 2026-11-08) : intertitre,
 * figure + légende, ligne d'infos, cartes de liens et icône du site, fichiers joints, contenus mêlés dans l'ordre fixe,
 * bloc indisponible. */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ArticleBlockContent, ArticleBlockView } from '@spok/shared';
import { ArticleBlock } from './ArticleBlock';
import { blockMetaLine } from './articleBlockContent';

type BlockItem = NonNullable<ArticleBlockView['item']>;
const item = (over: Partial<BlockItem>): BlockItem => ({
  id: 'i', type: 'NOTE', title: 'Titre', description: null, url: null,
  status: null, statusLabel: null, priority: null, startDate: null, endDate: null, dueDate: null,
  contents: [], canOpen: false, canEdit: false, spaceId: null, ...over,
});
let n = 0;
const content = (kind: ArticleBlockContent['kind'], url: string | null, name: string | null = null): ArticleBlockContent =>
  ({ id: `c${++n}`, kind, url, name, mimeType: null });
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

  it('que des images : figure, légende = titre + description, quel que soit le type', () => {
    const { container } = show(block(item({ type: 'UNDEFINED', title: 'Carte', description: '<p>Vue du nord</p>',
      contents: [content('IMAGE', 'https://r2/c.webp'), content('IMAGE', 'https://r2/d.webp')] })));
    const caption = container.querySelector('figcaption')!;
    expect(caption.textContent).toContain('Carte');
    expect(caption.textContent).toContain('Vue du nord');
    expect(container.querySelectorAll('figure img')).toHaveLength(2);
  });

  it('schéma sans aperçu ignoré ; adresse non sûre ignorée', () => {
    const { container } = show(block(item({ title: 'Plan', contents: [content('DIAGRAM', null), content('IMAGE', 'javascript:alert(1)')] })));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeTruthy();
  });

  it('contenus mêlés : intertitre, texte, puis Images, Fichiers, Liens', () => {
    const { container } = show(block(item({ type: 'TASK', title: 'Chantier', description: '<p>Le texte</p>', contents: [
      content('IMAGE', 'https://r2/photo.webp'),
      content('FILE', 'https://r2/docs/1729000000000-devis.pdf'),
      content('LINK', 'https://exemple.org/page', 'Fournisseur'),
    ] })));
    expect(screen.getByRole('heading', { name: 'Chantier' })).toBeTruthy();
    const html = container.innerHTML;
    expect(html.indexOf('Le texte')).toBeLessThan(html.indexOf('photo.webp'));
    expect(html.indexOf('photo.webp')).toBeLessThan(html.indexOf('devis.pdf'));
    expect(html.indexOf('devis.pdf')).toBeLessThan(html.indexOf('Fournisseur'));
    expect(container.querySelector('figure')).toBeNull();
  });

  it('tâche : ligne d’infos', () => {
    const it = item({ type: 'TASK', title: 'Livrer', statusLabel: 'À faire', priority: 4 });
    show(block(it));
    expect(screen.getByText(blockMetaLine(it)!)).toBeTruthy();
  });

  it('lien : icône du site, repli si elle ne charge pas', () => {
    const { container } = show(block(item({ title: 'Exemple', contents: [content('LINK', 'https://exemple.org/page')] })));
    expect(screen.getByText('Exemple')).toBeTruthy();
    const icon = container.querySelector('img[src="https://exemple.org/favicon.ico"]')!;
    expect(icon).toBeTruthy();
    fireEvent.error(icon);
    expect(container.querySelector('img[src="https://exemple.org/favicon.ico"]')).toBeNull();
    expect(container.querySelector('[data-fallback-icon]')).toBeTruthy();
  });

  it('fichiers : un lien par fichier, nommé d’après le contenu ou l’adresse', () => {
    show(block(item({ title: 'Rapport', contents: [
      content('FILE', 'https://r2/docs/1729000000000-rapport.pdf'),
      content('FILE', 'https://r2/docs/annexe.docx', 'Annexe signée'),
    ] })));
    expect(screen.getByRole('link', { name: /rapport\.pdf/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Annexe signée/ })).toBeTruthy();
  });

  it('bloc indisponible : encart, aucun contenu', () => {
    const { container } = show(block(null, false));
    expect(container.textContent).toContain('indisponible');
  });
});

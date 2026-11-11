/* TNR de ItemReadView — rendu de la fiche : image intégrée, document nommé, enfants cliquables, HTML nettoyé ; contenus
   multiples (lot 2) rendus après la description, à la place du média unique. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemReadView } from './ItemReadView';
import type { ItemSheet } from '../lib/itemClipboard';

const base: ItemSheet = {
  title: 'Mon schéma', fields: [{ label: 'Statut', value: 'En cours' }], tags: ['urgent'],
  descriptionHtml: '<p>Texte <strong>gras</strong></p><script>alert(1)</script>',
  media: { kind: 'image', label: 'Diagramme', url: 'https://r2/d.webp', name: 'Mon schéma' },
  children: [{ id: 'c1', title: 'Enfant', status: null }], relations: [], contributions: [],
};

describe('ItemReadView', () => {
  it('affiche titre, champs, image et description nettoyée', () => {
    const { container } = render(<ItemReadView sheet={base} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mon schéma');
    expect(screen.getByText('En cours')).toBeTruthy();
    expect(container.querySelector('img[src="https://r2/d.webp"]')).toBeTruthy();
    expect(container.innerHTML).toContain('<strong>gras</strong>');
    expect(container.innerHTML).not.toContain('<script');
  });

  it('document : lien nommé ; enfant cliquable', () => {
    const onOpenChild = vi.fn();
    render(<ItemReadView sheet={{ ...base, media: { kind: 'file', label: 'Fichier', url: 'https://r2/a.pdf', name: 'a.pdf' } }} onOpenChild={onOpenChild} />);
    expect(screen.getByText('a.pdf — Ouvrir').closest('a')?.getAttribute('href')).toBe('https://r2/a.pdf');
    fireEvent.click(screen.getByText('Enfant'));
    expect(onOpenChild).toHaveBeenCalledWith('c1');
  });

  it('contenus : regroupés après la description, le média unique n’est plus affiché', () => {
    const at = '2026-11-08T00:00:00Z';
    const contents = [
      { id: 'l1', itemId: 'i', kind: 'LINK', url: 'https://site.fr', name: 'Le site', position: 0, createdAt: at, updatedAt: at },
      { id: 'f1', itemId: 'i', kind: 'FILE', url: 'https://r2/b.pdf', name: 'b.pdf', size: 2048, position: 0, createdAt: at, updatedAt: at },
      { id: 'm1', itemId: 'i', kind: 'IMAGE', url: 'javascript:alert(1)', name: 'piège', position: 0, createdAt: at, updatedAt: at },
    ] as any;
    const { container } = render(<ItemReadView sheet={base} contents={contents} />);
    expect(container.querySelector('img[src="https://r2/d.webp"]')).toBeNull();
    expect(container.querySelector('img[src^="javascript"]')).toBeNull();
    const text = container.textContent ?? '';
    expect(text.indexOf('gras')).toBeLessThan(text.indexOf('Fichiers'));
    expect(text.indexOf('Fichiers')).toBeLessThan(text.indexOf('Liens'));
    expect(screen.getByText('b.pdf — Ouvrir').closest('a')?.getAttribute('href')).toBe('https://r2/b.pdf');
    expect(screen.getByText('Le site').closest('a')?.getAttribute('href')).toBe('https://site.fr');
  });
});

/* TNR de ItemReadView — rendu de la fiche : image intégrée, document nommé, enfants cliquables, HTML nettoyé. */
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
});

/* TNR de la confirmation d'ajout groupé dans un article (ArticleBatchConfirm) : compte, motifs, avertissement, garde. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ArticleBatchPreview } from '@spok/shared';
import { ArticleBatchConfirm } from './ArticleBatchConfirm';
import { pageHint } from '../../help/pageHint';

const preview = (over: Partial<ArticleBatchPreview>): ArticleBatchPreview => ({
  count: 12, skipped: { present: 0, unreadable: 0, articles: 0 }, tooMany: false, lessVisible: false, ...over,
});
const show = (p: ArticleBatchPreview | null) =>
  render(<ArticleBatchConfirm isOpen preview={p} isLoading={false} isPending={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
const confirmButton = () => screen.getByRole('button', { name: /Ajouter/ }) as HTMLButtonElement;

describe('ArticleBatchConfirm', () => {
  it('compte, motifs de saut, avertissement moins visible', () => {
    show(preview({ skipped: { present: 2, unreadable: 1, articles: 0 }, lessVisible: true }));
    expect(screen.getByText(/12 éléments seront ajoutés/)).toBeTruthy();
    expect(screen.getByText(/2 déjà présents/)).toBeTruthy();
    expect(screen.getByText(/1 illisible/)).toBeTruthy();
    expect(screen.getByText(pageHint('article', 'batchLessVisible')!)).toBeTruthy();
    expect(confirmButton().disabled).toBe(false);
  });

  it('lot vide : bouton désactivé', () => {
    show(preview({ count: 0, skipped: { present: 3, unreadable: 0, articles: 0 } }));
    expect(screen.getByText(pageHint('article', 'batchEmpty')!)).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
  });

  it('trop d’éléments : bouton désactivé et message', () => {
    show(preview({ count: 140, tooMany: true }));
    expect(screen.getByText(pageHint('article', 'batchTooMany')!)).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
  });
});

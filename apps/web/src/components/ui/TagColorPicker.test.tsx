/* Tests du sélecteur de couleur des tags (pastilles) : choix d'une teinte, « Aucune couleur », couleur hors palette gardée. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TagColorPicker } from './TagColorPicker';

describe('TagColorPicker', () => {
  it('choisit une teinte de la palette ou aucune couleur', () => {
    const onChange = vi.fn();
    render(<TagColorPicker value="#3b82f6" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Bleu' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Rouge' }));
    expect(onChange).toHaveBeenCalledWith('#ef4444');
    fireEvent.click(screen.getByRole('radio', { name: 'Aucune couleur' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('une couleur déjà enregistrée hors palette reste proposée et cochée', () => {
    render(<TagColorPicker value="#123456" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Couleur actuelle' }).getAttribute('aria-checked')).toBe('true');
  });
});

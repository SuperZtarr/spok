/* TNR du panneau partagé ElementTray (Process « Non placés », Composer d'un article « À ajouter ») : arbre trié par
 * position, enfant orphelin à la racine, branche repliée, recherche à plat sans accents, glisser (type MIME de
 * l'appelant), action de ligne, rien de glissable ni d'action sans droit d'édition, repli du panneau. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ElementTray, TrayElsewhereButton, trayRows } from './ElementTray';

const it_ = (id: string, parentId: string | null, position: number, title = `Titre ${id}`) => ({ id, type: 'UNDEFINED', title, parentId, position });
const items = [it_('b', null, 2), it_('a', null, 1), it_('a1', 'a', 1), it_('x', 'absent', 0, 'Élément orphelin')];

describe('trayRows', () => {
  it('arbre trié par position, orphelin à la racine', () => {
    expect(trayRows(items, '', new Set()).map((r) => [r.item.id, r.depth])).toEqual([['x', 0], ['a', 0], ['a1', 1], ['b', 0]]);
  });
  it('branche repliée : enfants masqués', () => {
    expect(trayRows(items, '', new Set(['a'])).map((r) => r.item.id)).toEqual(['x', 'a', 'b']);
  });
  it('recherche à plat, sans accents ni casse', () => {
    expect(trayRows(items, 'element', new Set()).map((r) => [r.item.id, r.depth, r.hasChildren])).toEqual([['x', 0, false]]);
  });
});

describe('ElementTray', () => {
  const labels = { title: 'À ajouter', empty: 'Vide' };

  it('glisser : type MIME de l\'appelant ; action de ligne ; autre espace', () => {
    const onPick = vi.fn();
    const onElsewhere = vi.fn();
    render(<ElementTray items={items} canEdit dragType="application/x-test" labels={labels}
      headerExtra={<TrayElsewhereButton onClick={onElsewhere} hint="h" />}
      rowAction={(i) => <button type="button" onClick={() => onPick(i.id)}>{`+${i.id}`}</button>} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Titre a').closest('li')!, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/x-test', 'a');
    fireEvent.click(screen.getByText('+b'));
    expect(onPick).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByText('Ajouter d\'un autre espace'));
    expect(onElsewhere).toHaveBeenCalled();
    expect(screen.getByText('À ajouter (4)')).toBeTruthy();
  });

  it('sans droit d\'édition : ni glisser, ni action, ni autre espace', () => {
    render(<ElementTray items={items} canEdit={false} dragType="t" labels={labels}
      headerExtra={<TrayElsewhereButton onClick={vi.fn()} hint="h" />} rowAction={(i) => <button type="button">{`+${i.id}`}</button>} />);
    expect(screen.getByText('Titre a').closest('li')!.getAttribute('draggable')).toBe('false');
    expect(screen.queryByText('+a')).toBeNull();
    expect(screen.queryByText('Ajouter d\'un autre espace')).toBeNull();
  });

  it('liste vide et repli du panneau', () => {
    render(<ElementTray items={[]} canEdit dragType="t" labels={labels} />);
    expect(screen.getByText('Vide')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Replier le panneau'));
    expect(screen.getByLabelText('Afficher : À ajouter')).toBeTruthy();
  });
});

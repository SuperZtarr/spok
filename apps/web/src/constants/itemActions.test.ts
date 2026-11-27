/* Test de cohérence du registre des actions d'un élément (constants/itemActions.ts, vocabulaire unique 2026-11-26) :
 * les trois modes Lire | Modifier | Composer, libellés uniques, jamais « item », et les deux menus qui en dérivent. */
import { describe, it, expect, vi } from 'vitest';
import { ITEM_ACTIONS, ITEM_MODES } from './itemActions';
import { buildSheetActionGroups } from '../components/itemSheetActions';
import { buildItemMenuGroups } from '../lib/itemMenuGroups';

describe('registre des actions', () => {
  it('modes : Lire, Modifier, Composer, dans cet ordre', () => {
    expect(ITEM_MODES.map((m) => ITEM_ACTIONS[m].label)).toEqual(['Lire', 'Modifier', 'Composer']);
  });

  it('libellés uniques, sans le mot « item » ni « Afficher » / « Ouvrir » pour un mode', () => {
    const labels = Object.values(ITEM_ACTIONS).map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const l of labels) expect(l.toLowerCase()).not.toMatch(/\bitems?\b/);
    expect(labels).not.toContain('Afficher');
    expect(labels).not.toContain('Ouvrir');
  });

  it('les deux menus ne montrent que des libellés du registre', () => {
    const known = new Set(Object.values(ITEM_ACTIONS).map((a) => a.label as string));
    const sheet = buildSheetActionGroups({
      print: vi.fn(), exportPdf: vi.fn(), copySheet: vi.fn(), copyThumbnail: vi.fn(), copyId: vi.fn(), toggleBookmark: vi.fn(),
      markUnread: vi.fn(), duplicate: vi.fn(), move: vi.fn(), convertToSpace: vi.fn(), absorbChildren: vi.fn(),
      splitDescription: vi.fn(), merge: vi.fn(), saveAsTemplate: vi.fn(), insertTemplate: vi.fn(), delete: vi.fn(),
    }, { canEdit: true, isBookmarked: false }).flatMap((g) => g.actions);
    const menu = buildItemMenuGroups('i1', {
      onOpen: vi.fn(), onOpenInNewTab: vi.fn(), onDelete: vi.fn(), onAddChild: vi.fn(), onMoveToSpace: vi.fn(),
      onDuplicateToSpace: vi.fn(), onConvertToSpace: vi.fn(), onSelfAssign: vi.fn(), onMerge: vi.fn(),
      onAbsorbChildren: vi.fn(), onSplitDescription: vi.fn(),
    }, { item: { type: 'ARTICLE', spaceId: 's1' } }).flatMap((g) => g.actions);
    for (const a of [...sheet, ...menu]) expect(known.has(a.label)).toBe(true);
  });
});

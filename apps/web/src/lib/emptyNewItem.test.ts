/* Tests de la règle « élément vide tout juste créé » (emptyNewItem.ts) : contenu qui compte ou non, fraîcheur. */
import { describe, it, expect } from 'vitest';
import { isItemEmpty, isFreshDraft, FRESH_DRAFT_MAX_AGE_MS } from './emptyNewItem';

const blank = { title: '', description: null, url: null, content: null, dueDate: null, startDate: null, endDate: null, priority: null, assignedToId: null, tags: [] };

describe('isItemEmpty', () => {
  it('vide : titre blanc, description vide de l\'éditeur, type et statut ignorés', () => {
    expect(isItemEmpty({ ...blank, title: '  ', description: '<p></p>' }, 0)).toBe(true);
    expect(isItemEmpty({ ...blank, description: '<p>&nbsp;</p>', ...({ type: 'TASK', status: 'todo' } as object) }, 0)).toBe(true);
  });

  it('non vide dès qu\'un contenu existe', () => {
    expect(isItemEmpty({ ...blank, title: 'A' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, description: '<p>x</p>' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, description: '<p><img src="a.webp"></p>' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, url: 'https://x.fr' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, content: { xml: '<x/>' } }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, dueDate: '2026-11-01' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, priority: 2 }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, assignedToId: 'u' }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, tags: [{ id: 't' } as never] }, 0)).toBe(false);
    expect(isItemEmpty(blank, 1)).toBe(false);
    expect(isItemEmpty({ ...blank, contributions: [{}] }, 0)).toBe(false);
    expect(isItemEmpty({ ...blank, relationsTo: [{}] }, 0)).toBe(false);
  });
});

describe('isFreshDraft', () => {
  const opened = Date.parse('2026-10-28T10:00:00Z');
  it('créé par moi juste avant l\'ouverture', () => {
    expect(isFreshDraft({ createdById: 'me', createdAt: '2026-10-28T09:59:58Z' }, 'me', opened)).toBe(true);
  });
  it('ancien, créé par un autre, ou utilisateur inconnu : jamais', () => {
    expect(isFreshDraft({ createdById: 'me', createdAt: new Date(opened - FRESH_DRAFT_MAX_AGE_MS - 1000).toISOString() }, 'me', opened)).toBe(false);
    expect(isFreshDraft({ createdById: 'other', createdAt: '2026-10-28T09:59:58Z' }, 'me', opened)).toBe(false);
    expect(isFreshDraft({ createdById: 'me', createdAt: '2026-10-28T09:59:58Z' }, undefined, opened)).toBe(false);
  });
});

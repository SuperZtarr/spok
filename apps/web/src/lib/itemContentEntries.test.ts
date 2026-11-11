/* Tests des entrées des vues Images / Documents / Liens (une entrée par contenu, lot 3a). */
import { describe, it, expect } from 'vitest';
import type { Item, ItemContent } from '@spok/shared';
import { contentEntries, fileExtension } from './itemContentEntries';

let n = 0;
const content = (kind: ItemContent['kind'], url: string | null, name: string | null = null): ItemContent => ({
  id: `c${++n}`, itemId: 'x', kind, url, name, position: 0, createdAt: '2026-11-08', updatedAt: '2026-11-08',
});
const item = (id: string, title: string, contents: ItemContent[], type: Item['type'] = 'UNDEFINED') =>
  ({ id, title, type, contents } as unknown as Item);

describe('contentEntries', () => {
  it('une entrée par contenu de la sorte, quel que soit le type', () => {
    const items = [
      item('a', 'Tâche', [content('FILE', 'https://r2/x/1730000000000-plan.pdf'), content('FILE', 'https://r2/x/compte.docx', 'Compte')], 'TASK'),
      item('b', 'Note', [content('IMAGE', 'https://r2/x/photo.png')], 'NOTE'),
    ];
    const files = contentEntries(items, ['FILE']);
    expect(files.map((e) => e.label)).toEqual(['Tâche — plan.pdf', 'Tâche — Compte']);
    expect(files[0].item.id).toBe('a');
    expect(contentEntries(items, ['IMAGE']).map((e) => e.label)).toEqual(['Note']);
  });

  it('ignore les contenus sans adresse ou à adresse non sûre', () => {
    const items = [item('a', 'Schéma', [content('DIAGRAM', null), content('LINK', 'javascript:alert(1)')])];
    expect(contentEntries(items, ['DIAGRAM', 'LINK'])).toEqual([]);
  });

  it('élément sans contenus ou liste absente → aucune entrée', () => {
    expect(contentEntries(undefined, ['FILE'])).toEqual([]);
    expect(contentEntries([item('a', 'Vide', undefined as unknown as ItemContent[])], ['FILE'])).toEqual([]);
  });
});

describe('fileExtension', () => {
  it('depuis le nom, sinon depuis l’adresse', () => {
    expect(fileExtension({ name: 'rapport.pdf', url: 'https://r2/x' })).toBe('PDF');
    expect(fileExtension({ name: 'Rapport', url: 'https://r2/x/1-rapport.docx?v=2' })).toBe('DOCX');
    expect(fileExtension({ name: 'Rapport', url: 'https://r2/x/rapport' })).toBe('');
  });
});

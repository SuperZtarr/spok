/* TNR de itemOpenMode — format d'URL du mode Afficher et mode par défaut (lecture pour qui ne peut pas modifier). */
import { describe, it, expect } from 'vitest';
import { itemUrl, parseItemMode, resolveItemMode } from './itemOpenMode';

describe('itemOpenMode', () => {
  it('URL : mode lecture porté par &mode=lecture, rien sinon', () => {
    expect(itemUrl('s1', 'i1', 'read')).toBe('/spaces/s1/content?item=i1&mode=lecture');
    expect(itemUrl('s1', 'i1', 'edit')).toBe('/spaces/s1/content?item=i1');
    expect(itemUrl('s1', 'i1')).toBe('/spaces/s1/content?item=i1');
  });

  it('lecture du paramètre', () => {
    expect(parseItemMode('lecture')).toBe('read');
    expect(parseItemMode(null)).toBeUndefined();
    expect(parseItemMode('xx')).toBeUndefined();
  });

  it('défaut : édition si l\'espace est modifiable, lecture sinon ; un mode demandé prime', () => {
    expect(resolveItemMode(undefined, true)).toBe('edit');
    expect(resolveItemMode(undefined, false)).toBe('read');
    expect(resolveItemMode('read', true)).toBe('read');
    expect(resolveItemMode('edit', false)).toBe('edit');
  });
});

/* Tests de lib/spaceParentOptions.ts : périmètre communauté, indentation, exclusion du sous-arbre déplacé. */
import { describe, it, expect } from 'vitest';
import { buildParentOptions, ROOT_OPTION_LABEL } from './spaceParentOptions';

const S = (id: string, parentId: string | null, communityId: string | null = 'c1', type = 'GROUP') =>
  ({ id, name: id.toUpperCase(), type, parentId, communityId });

const spaces = [S('a', null), S('a1', 'a'), S('a1x', 'a1'), S('b', null), S('z', null, 'c2'), S('perso', null, null, 'PERSONAL'), S('libre', null, null)];

describe('buildParentOptions', () => {
  it('liste les espaces de la communauté en arbre, racine en premier', () => {
    const opts = buildParentOptions(spaces, 'c1');
    expect(opts[0]).toEqual({ value: '', label: ROOT_OPTION_LABEL });
    expect(opts.map((o) => o.value)).toEqual(['', 'a', 'a1', 'a1x', 'b']);
    expect(opts[2].label).toContain('└ A1');
  });

  it('exclut l\'espace déplacé et tous ses descendants', () => {
    expect(buildParentOptions(spaces, 'c1', 'a1').map((o) => o.value)).toEqual(['', 'a', 'b']);
  });

  it('sans communauté : espaces indépendants seulement, jamais d\'espace personnel', () => {
    expect(buildParentOptions(spaces, null).map((o) => o.value)).toEqual(['', 'libre']);
  });

  it('un espace dont le parent est hors périmètre est traité comme racine', () => {
    expect(buildParentOptions([S('orphelin', 'inconnu')], 'c1').map((o) => o.value)).toEqual(['', 'orphelin']);
  });
});

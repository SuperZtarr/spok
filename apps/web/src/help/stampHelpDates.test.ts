/* Tests de la datation des annonces à la MEP (scripts/stamp-help-dates.mjs) : seules les annonces sans date sont touchées, et
   une phrase contenant des accolades, des apostrophes ou le mot « date: » ne trompe pas le script. */
import { describe, it, expect } from 'vitest';
import { stampChangeDates, undatedChanges } from '../../../../scripts/stamp-help-dates.mjs';

const DATE = '2026-11-08';

describe('stampChangeDates', () => {
  it('date une annonce écrite sur plusieurs lignes', () => {
    const source = `changes: [{\n      id: 'a',\n      kind: 'new',\n      text: 'Texte',\n    }],`;
    expect(stampChangeDates(source, DATE)).toBe(`changes: [{\n      id: 'a',\n      kind: 'new',\n      text: 'Texte',\n      date: '2026-11-08',\n    }],`);
  });

  it('date une annonce écrite sur une ligne', () => {
    expect(stampChangeDates(`changes: [{ id: 'a', kind: 'new', text: 'T' }]`, DATE)).toBe(`changes: [{ id: 'a', kind: 'new', text: 'T', date: '2026-11-08' }]`);
  });

  it('ne modifie jamais une date déjà posée', () => {
    const source = `changes: [{ id: 'a', kind: 'new', text: 'T', date: '2026-01-01' }]`;
    expect(stampChangeDates(source, DATE)).toBe(source);
  });

  it('dans un même tableau, ne date que les annonces qui n\'en ont pas', () => {
    const stamped = stampChangeDates(`changes: [{ id: 'a', date: '2026-01-01' }, { id: 'b' }]`, DATE);
    expect(stamped).toBe(`changes: [{ id: 'a', date: '2026-01-01' }, { id: 'b', date: '2026-11-08' }]`);
  });

  it('ne se trompe pas sur les textes qui contiennent accolades, apostrophes échappées ou le mot date', () => {
    const source = `changes: [{ id: 'a', text: 'L\\'objet { date: x } ]' }]`;
    expect(stampChangeDates(source, DATE)).toBe(`changes: [{ id: 'a', text: 'L\\'objet { date: x } ]', date: '2026-11-08' }]`);
  });

  it('laisse intact un fichier sans annonce, et dater deux fois ne change rien', () => {
    const none = `const elements = { titre: { title: 'T', date: 'non' } };`;
    expect(stampChangeDates(none, DATE)).toBe(none);
    const once = stampChangeDates(`changes: [{ id: 'a' }]`, DATE);
    expect(stampChangeDates(once, '2030-01-01')).toBe(once);
  });

  it('traite plusieurs tableaux d\'un même fichier', () => {
    const stamped = stampChangeDates(`a: { changes: [{ id: 'a' }] }, b: { changes: [{ id: 'b' }] }`, DATE);
    expect(undatedChanges(stamped)).toEqual([]);
  });
});

describe('undatedChanges', () => {
  it('liste les identifiants des seules annonces sans date', () => {
    expect(undatedChanges(`changes: [{ id: 'a', date: '2026-01-01' }, { id: 'b' }]`)).toEqual(['b']);
  });
});

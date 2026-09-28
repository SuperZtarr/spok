/* Tests de la source unique des types de relation (relationTypes.ts). */
import { RELATION_TYPES } from '@spok/shared';
import { RELATION_TYPE_LIST, getRelationMeta, isOrderingRelation, isOfficialRelationType } from './relationTypes';

describe('relationTypes', () => {
  it('couvre exactement les types officiels proposés à l\'utilisateur (RELATION_TYPES hors parent)', () => {
    const offered = RELATION_TYPES.filter((t) => t !== 'parent').slice().sort();
    expect(RELATION_TYPE_LIST.map((m) => m.id).sort()).toEqual(offered);
  });

  it('libellés attendus', () => {
    expect(getRelationMeta('blocks').label).toBe('Bloque');
    expect(getRelationMeta('blocks').inverseLabel).toBe('Bloqué par');
    expect(getRelationMeta('implements').label).toBe('Permet');
    expect(getRelationMeta('drives').label).toBe('Entraîne');
    expect(getRelationMeta('relates').label).toBe('Lié à');
  });

  it('type hors liste : nom brut, gris, non officiel', () => {
    const meta = getRelationMeta('depends');
    expect(meta.label).toBe('depends');
    expect(meta.hex).toBe('#9ca3af');
    expect(isOfficialRelationType('depends')).toBe(false);
    expect(isOfficialRelationType('drives')).toBe(true);
  });

  it('seuls blocks et implements ordonnent', () => {
    expect(isOrderingRelation('blocks')).toBe(true);
    expect(isOrderingRelation('implements')).toBe(true);
    expect(isOrderingRelation('drives')).toBe(false);
    expect(isOrderingRelation('relates')).toBe(false);
    expect(isOrderingRelation('depends')).toBe(false);
  });
});

/* Tests du registre des champs exportables (EXPORT_FIELD_REGISTRY, shared) et de buildItemRows (exportUtils) :
   ids uniques, table des valeurs du web couvrant exactement le registre, sélection et ordre des colonnes respectés,
   normalisation d'une préférence mémorisée (ids inconnus, doublons, vide). */
import { describe, it, expect } from 'vitest';
import type { Item } from '@spok/shared';
import { EXPORT_FIELD_REGISTRY, EXPORT_FIELD_IDS, normalizeExportFields } from '@spok/shared';
import { buildItemRows, EXPORT_FIELD_VALUES } from './exportUtils';

const items = [
  { id: 'p', title: 'Projet', type: 'PROJECT', status: 'todo', priority: 2, parentId: null, description: '<p>Desc <b>riche</b></p>', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-02T10:00:00Z' },
  { id: 'c', title: 'Tâche', type: 'TASK', status: 'done', parentId: 'p', tags: [{ name: 'a' }, { name: 'b' }], createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-02T10:00:00Z' },
] as unknown as Item[];

describe('registre des champs exportables', () => {
  it('ids et libellés uniques', () => {
    expect(new Set(EXPORT_FIELD_IDS).size).toBe(EXPORT_FIELD_REGISTRY.length);
    expect(new Set(EXPORT_FIELD_REGISTRY.map(f => f.label)).size).toBe(EXPORT_FIELD_REGISTRY.length);
  });

  it('la table des valeurs du web couvre exactement le registre', () => {
    expect(Object.keys(EXPORT_FIELD_VALUES).sort()).toEqual([...EXPORT_FIELD_IDS].sort());
  });
});

describe('buildItemRows', () => {
  it('sans sélection : tous les champs dans l\'ordre du registre', () => {
    const rows = buildItemRows(items);
    expect(Object.keys(rows[0])).toEqual(EXPORT_FIELD_REGISTRY.map(f => f.label));
  });

  it('respecte la sélection et son ordre', () => {
    const rows = buildItemRows(items, ['status', 'title', 'parent']);
    expect(Object.keys(rows[1])).toEqual(['Statut', 'Titre', 'Parent']);
    expect(rows[1]).toEqual({ 'Statut': 'done', 'Titre': 'Tâche', 'Parent': 'Projet' });
  });

  it('valeurs : tags joints, description sans HTML', () => {
    const rows = buildItemRows(items, ['tags', 'description']);
    expect(rows[1]['Tags']).toBe('a, b');
    expect(rows[0]['Description']).toBe('Desc riche');
  });

  it('références externes, créé par, contenus, identifiant', () => {
    const withExtras = [{
      ...items[0],
      externalRefs: ['Jira : PROJ-1', 'CRM : 42'],
      createdBy: { id: 'u', name: 'Ana' },
      contents: [{ name: 'plan.pdf', url: 'https://x/plan.pdf' }, { name: '', url: 'https://exemple.fr' }],
    }] as unknown as Item[];
    const row = buildItemRows(withExtras, ['externalRefs', 'createdBy', 'contents', 'id'])[0];
    expect(row).toEqual({
      'Références externes': 'Jira : PROJ-1 | CRM : 42',
      'Créé par': 'Ana',
      'Contenus': 'plan.pdf, https://exemple.fr',
      'Identifiant': 'p',
    });
  });
});

describe('normalizeExportFields', () => {
  it('vide ou absent → tous les champs', () => {
    expect(normalizeExportFields(undefined)).toEqual([...EXPORT_FIELD_IDS]);
    expect(normalizeExportFields([])).toEqual([...EXPORT_FIELD_IDS]);
  });

  it('retire les ids inconnus et les doublons, garde l\'ordre', () => {
    expect(normalizeExportFields(['tags', 'inconnu', 'title', 'tags'])).toEqual(['tags', 'title']);
  });
});

/* Tests de exportContents (itemExport.ts) : contenus d'un élément exportés, regroupés dans l'ordre fixe (lot 3a). */
import { describe, it, expect } from 'vitest';
import type { ItemContent } from '@spok/shared';
import { exportContents } from './itemExport';

let n = 0;
const c = (kind: ItemContent['kind'], url: string | null, name: string | null = null, position = 0): ItemContent => ({
  id: `c${++n}`, itemId: 'i', kind, url, name, position, createdAt: '2026-11-08', updatedAt: '2026-11-08',
});

describe('exportContents', () => {
  it('regroupe Images, Fichiers, Liens, Schémas dans l’ordre fixe, quel que soit l’ordre reçu', () => {
    const groups = exportContents({ contents: [
      c('LINK', 'https://exemple.org', 'Site'),
      c('FILE', 'https://r2/1729000000000-devis.pdf'),
      c('IMAGE', 'https://r2/photo.webp'),
    ] });
    expect(groups.map((g) => g.label)).toEqual(['Images', 'Fichiers', 'Liens']);
    expect(groups[1].contents[0].name).toBe('devis.pdf');
    expect(groups[2].contents[0]).toEqual({ kind: 'LINK', url: 'https://exemple.org', name: 'Site' });
  });

  it('adresse non sûre retirée ; schéma sans aperçu gardé par son nom', () => {
    const groups = exportContents({ contents: [c('LINK', 'javascript:alert(1)'), c('DIAGRAM', null, 'Plan')] });
    expect(groups).toEqual([{ kind: 'DIAGRAM', label: 'Schémas', contents: [{ kind: 'DIAGRAM', url: null, name: 'Plan' }] }]);
  });

  it('aucun contenu → aucune section', () => {
    expect(exportContents({})).toEqual([]);
  });
});

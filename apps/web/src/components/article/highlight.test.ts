/* Tests du découpage en segments surlignés (highlight.ts) — sélecteur d'éléments d'un article. */
import { describe, it, expect } from 'vitest';
import { highlightSegments } from './highlight';

describe('highlightSegments', () => {
  it('isole la partie trouvée, casse ignorée', () => {
    expect(highlightSegments('Le Plan B', 'plan')).toEqual([
      { text: 'Le ', match: false },
      { text: 'Plan', match: true },
      { text: ' B', match: false },
    ]);
  });

  it('ignore les accents', () => {
    expect(highlightSegments('Été', 'ete')).toEqual([{ text: 'Été', match: true }]);
  });

  it('terme vide : un seul segment non trouvé', () => {
    expect(highlightSegments('Texte', '')).toEqual([{ text: 'Texte', match: false }]);
  });
});

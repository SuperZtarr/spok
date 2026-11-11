/*
 * Tests de la réunion des contenus (fusion, absorption — lot 5 contenus multiples) : cumul après les contenus de
 * l'élément gardé, positions par sorte, doublons (lien normalisé, fichier même url ou même nom+taille, schéma même
 * xml), plafond.
 */
import { describe, it, expect } from 'vitest';
import { ITEM_CONTENTS_MAX } from '@spok/shared';
import { planContentMerge, normalizeLinkUrl, type MergeableContent } from './contentMerge.js';

let n = 0;
const c = (itemId: string, kind: string, extra: Partial<MergeableContent> = {}): MergeableContent => ({
  id: `c${++n}`, itemId, kind, url: null, name: null, size: null, xml: null, position: 0, ...extra,
});

describe('normalizeLinkUrl', () => {
  it('ignore la casse du domaine et le « / » final, garde le chemin', () => {
    expect(normalizeLinkUrl('HTTPS://Example.COM/Docs/')).toBe(normalizeLinkUrl('https://example.com/Docs'));
    expect(normalizeLinkUrl('https://example.com/a')).not.toBe(normalizeLinkUrl('https://example.com/A'));
  });
});

describe('planContentMerge', () => {
  it('cumule à la suite des contenus gardés, dans chaque sorte', () => {
    const kept = [c('t', 'IMAGE', { url: 'i1', position: 0 }), c('t', 'IMAGE', { url: 'i2', position: 1 }), c('t', 'LINK', { url: 'https://a.fr', position: 0 })];
    const inc = [c('s', 'IMAGE', { url: 'i3', position: 0 }), c('s', 'FILE', { url: 'f1', name: 'a.pdf', size: 10, position: 0 })];
    const plan = planContentMerge(kept, inc);
    expect(plan.moves).toEqual([{ id: inc[0].id, position: 2 }, { id: inc[1].id, position: 0 }]);
    expect(plan.total).toBe(5);
    expect(plan.duplicateIds).toEqual([]);
    expect(plan.tooMany).toBe(false);
  });

  it('retire les doublons : lien normalisé, fichier même url ou même nom+taille, schéma même dessin', () => {
    const kept = [
      c('t', 'LINK', { url: 'https://Site.fr/page/' }),
      c('t', 'FILE', { url: 'u1', name: 'cr.pdf', size: 42 }),
      c('t', 'IMAGE', { url: 'img' }),
      c('t', 'DIAGRAM', { xml: '<mx/>' }),
    ];
    const inc = [
      c('s', 'LINK', { url: 'https://site.fr/page' }),
      c('s', 'FILE', { url: 'u2', name: 'cr.pdf', size: 42 }),
      c('s', 'IMAGE', { url: 'img' }),
      c('s', 'DIAGRAM', { xml: '<mx/>' }),
      c('s', 'FILE', { url: 'u3', name: 'cr.pdf', size: 43 }), // même nom, autre taille : pas un doublon
    ];
    const plan = planContentMerge(kept, inc);
    expect(plan.duplicateIds).toEqual(inc.slice(0, 4).map((x) => x.id));
    expect(plan.moves.map((m) => m.id)).toEqual([inc[4].id]);
    expect(plan.total).toBe(5);
  });

  it('une même sorte différente n\'est jamais un doublon ; doublons entre éléments réunis aussi retirés', () => {
    const inc = [c('a', 'IMAGE', { url: 'x' }), c('a', 'FILE', { url: 'x' }), c('b', 'IMAGE', { url: 'x' })];
    const plan = planContentMerge([], inc);
    expect(plan.moves.map((m) => m.id)).toEqual([inc[0].id, inc[1].id]);
    expect(plan.duplicateIds).toEqual([inc[2].id]);
  });

  it('signale le dépassement du plafond (doublons non comptés)', () => {
    const kept = Array.from({ length: ITEM_CONTENTS_MAX }, (_, i) => c('t', 'LINK', { url: `https://k${i}.fr`, position: i }));
    expect(planContentMerge(kept, [c('s', 'LINK', { url: 'https://k0.fr' })]).tooMany).toBe(false);
    const plan = planContentMerge(kept, [c('s', 'LINK', { url: 'https://new.fr' })]);
    expect(plan.tooMany).toBe(true);
    expect(plan.total).toBe(ITEM_CONTENTS_MAX + 1);
  });
});

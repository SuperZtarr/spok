/* Tests de la ligne d'infos, de l'icône du site et de la disposition selon les contenus des blocs d'article (articleBlockContent.ts). */
import { describe, it, expect } from 'vitest';
import type { ArticleBlockView } from '@spok/shared';
import { blockContents, blockLayout, blockMetaLine, imageArrangement, isShortCaption, siteIconUrl } from './articleBlockContent';
import { formatDate, formatDateTime } from '../../lib/utils';

type BlockItem = NonNullable<ArticleBlockView['item']>;
const item = (over: Partial<BlockItem>): BlockItem => ({
  id: 'i', type: 'NOTE', title: 'T', description: null, url: null,
  status: null, statusLabel: null, priority: null, startDate: null, endDate: null, dueDate: null,
  contents: [], canOpen: false, canEdit: false, spaceId: null, ...over,
});

describe('blockMetaLine', () => {
  it('réunion : date et heures de début et de fin', () => {
    const line = blockMetaLine(item({ type: 'MEETING', startDate: '2026-11-12T13:00:00.000Z', endDate: '2026-11-12T14:30:00.000Z' }))!;
    const start = formatDateTime('2026-11-12T13:00:00.000Z');
    const endTime = formatDateTime('2026-11-12T14:30:00.000Z').split(' ').pop()!;
    expect(line).toContain(start);
    expect(line).toContain(endTime);
  });

  it('tâche : statut · échéance · priorité', () => {
    const due = '2026-11-12T00:00:00.000Z';
    expect(blockMetaLine(item({ type: 'TASK', statusLabel: 'À faire', dueDate: due, priority: 4 })))
      .toBe(`À faire · Échéance ${formatDate(due)} · Urgente`);
  });

  it('tâche sans infos → null', () => {
    expect(blockMetaLine(item({ type: 'TASK' }))).toBeNull();
  });

  it('projet : plage de dates puis statut, plages partielles', () => {
    const s = '2026-11-01T00:00:00.000Z';
    const e = '2026-12-01T00:00:00.000Z';
    expect(blockMetaLine(item({ type: 'PROJECT', startDate: s, endDate: e, statusLabel: 'En cours' })))
      .toBe(`du ${formatDate(s)} au ${formatDate(e)} · En cours`);
    expect(blockMetaLine(item({ type: 'PROJECT', startDate: s }))).toBe(`à partir du ${formatDate(s)}`);
    expect(blockMetaLine(item({ type: 'PROJECT', endDate: e }))).toBe(`jusqu’au ${formatDate(e)}`);
  });

  it('période : plage de dates ; types de contenu → null', () => {
    const s = '2026-11-01T00:00:00.000Z';
    const e = '2026-12-01T00:00:00.000Z';
    expect(blockMetaLine(item({ type: 'PERIOD', startDate: s, endDate: e }))).toBe(`du ${formatDate(s)} au ${formatDate(e)}`);
    for (const type of ['NOTE', 'DOCUMENT', 'IMAGE', 'LINK'] as const) {
      expect(blockMetaLine(item({ type, startDate: s, statusLabel: 'X' }))).toBeNull();
    }
  });

  it('date invalide ignorée sans exception', () => {
    expect(blockMetaLine(item({ type: 'TASK', dueDate: 'pas-une-date', statusLabel: 'À faire' }))).toBe('À faire');
  });
});

describe('siteIconUrl', () => {
  it('icône à la racine du site, seulement pour http(s)', () => {
    expect(siteIconUrl('https://www.youtube.com/watch?v=x')).toBe('https://www.youtube.com/favicon.ico');
    expect(siteIconUrl('file:///C:/a.pdf')).toBeNull();
    expect(siteIconUrl(null)).toBeNull();
  });
});

describe('blockLayout (contenus multiples, lot 3a)', () => {
  const c = (kind: 'IMAGE' | 'FILE' | 'LINK' | 'DIAGRAM', url: string | null = 'https://r2/x') =>
    ({ id: kind + url, kind, url, name: null, mimeType: null });
  it('figure si que des images / schémas avec aperçu', () => {
    expect(blockLayout(item({ contents: [c('IMAGE'), c('DIAGRAM')] }))).toBe('figure');
  });
  it('links si que des liens', () => {
    expect(blockLayout(item({ contents: [c('LINK'), c('LINK', 'https://b')] }))).toBe('links');
  });
  it('section si mêlés, vides, ou seulement des contenus non affichables', () => {
    expect(blockLayout(item({ contents: [c('IMAGE'), c('FILE')] }))).toBe('section');
    expect(blockLayout(item({ contents: [] }))).toBe('section');
    expect(blockLayout(item({ contents: [c('DIAGRAM', null), c('LINK', 'javascript:x')] }))).toBe('section');
    expect(blockContents(item({ contents: [c('DIAGRAM', null), c('FILE')] }))).toHaveLength(1);
  });
  it('images avec un vrai texte → section (le texte garde sa mise en page) ; légende courte → figure', () => {
    const imgs = [c('IMAGE'), c('IMAGE', 'https://r2/y')];
    expect(blockLayout(item({ contents: imgs, description: '<p>Amulette de lune</p>' }))).toBe('figure');
    expect(blockLayout(item({ contents: imgs, description: '<p>Un</p><p>Deux</p>' }))).toBe('section');
    expect(blockLayout(item({ contents: imgs, description: `<p>${'x'.repeat(201)}</p>` }))).toBe('section');
  });
});

describe('isShortCaption', () => {
  it('vide ou un paragraphe court', () => {
    expect(isShortCaption(null)).toBe(true);
    expect(isShortCaption('<p></p>')).toBe(true);
    expect(isShortCaption('<p>Une <strong>légende</strong></p>')).toBe(true);
  });
  it('plusieurs paragraphes, liste, saut de ligne ou texte long → non', () => {
    expect(isShortCaption('<p>a</p><p>b</p>')).toBe(false);
    expect(isShortCaption('<ul><li>a</li></ul>')).toBe(false);
    expect(isShortCaption('<p>a<br>b</p>')).toBe(false);
    expect(isShortCaption('x'.repeat(201))).toBe(false);
  });
});

describe('imageArrangement', () => {
  it('selon le nombre d\'images et la présence d\'un texte', () => {
    expect(imageArrangement(0, true)).toBe('none');
    expect(imageArrangement(1, true)).toBe('beside');
    expect(imageArrangement(1, false)).toBe('single');
    expect(imageArrangement(2, true)).toBe('gallery');
    expect(imageArrangement(5, false)).toBe('gallery');
  });
});

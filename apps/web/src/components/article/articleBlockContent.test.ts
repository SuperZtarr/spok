/* Tests de la ligne d'infos et de l'icône du site des blocs d'article (articleBlockContent.ts). */
import { describe, it, expect } from 'vitest';
import type { ArticleBlockView } from '@spok/shared';
import { blockMetaLine, siteIconUrl } from './articleBlockContent';
import { formatDate, formatDateTime } from '../../lib/utils';

type BlockItem = NonNullable<ArticleBlockView['item']>;
const item = (over: Partial<BlockItem>): BlockItem => ({
  id: 'i', type: 'NOTE', title: 'T', description: null, url: null,
  status: null, statusLabel: null, priority: null, startDate: null, endDate: null, dueDate: null,
  canOpen: false, canEdit: false, spaceId: null, ...over,
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

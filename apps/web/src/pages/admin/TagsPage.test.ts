/* TNR de la page d'administration des tags : regroupement de l'onglet « Tous les tags » par portée (groupAdminTags,
   2026-11-13) et règle de cible de fusion (canBeMergeTarget). */
import { describe, it, expect } from 'vitest';
import type { AdminTag } from '../../lib/api';
import { groupAdminTags } from './TagsPage';

const tag = (id: string, name: string, scope: AdminTag['scope'], extra: Partial<AdminTag> = {}) =>
  ({ id, name, color: null, scope, communityId: null, communityName: null, spaceId: null, spaceName: null, itemCount: 0, ...extra }) as AdminTag;

describe('groupAdminTags', () => {
  it('sections Globaux, Communautés, Espaces ; un groupe par communauté / espace, triés par nom', () => {
    const sections = groupAdminTags([
      tag('s1', 'zz', 'space', { spaceId: 'sp', spaceName: 'Projet' }),
      tag('c2', 'b', 'community', { communityId: 'c-b', communityName: 'Beta' }),
      tag('g1', 'Urgent', 'global'),
      tag('c1', 'a', 'community', { communityId: 'c-a', communityName: 'Alpha' }),
      tag('c3', 'a2', 'community', { communityId: 'c-b', communityName: 'Beta' }),
      tag('g0', 'bug', 'global'),
    ]);
    expect(sections.map((s) => [s.label, s.count])).toEqual([['Globaux', 2], ['Communautés', 3], ['Espaces', 1]]);
    expect(sections[0].groups).toEqual([{ key: 'global', label: null, tags: [expect.objectContaining({ id: 'g0' }), expect.objectContaining({ id: 'g1' })] }]);
    expect(sections[1].groups.map((g) => [g.label, g.tags.map((t) => t.id)])).toEqual([['Alpha', ['c1']], ['Beta', ['c3', 'c2']]]);
    expect(sections[2].groups.map((g) => g.label)).toEqual(['Projet']);
  });

  it('sections vides omises', () => {
    expect(groupAdminTags([tag('g', 'x', 'global')]).map((s) => s.scope)).toEqual(['global']);
    expect(groupAdminTags([])).toEqual([]);
  });
});

/* TNR de spaceDefaultView : vue de l'espace d'abord, puis contexte de la communauté, puis Liste. */
import { describe, it, expect } from 'vitest';
import { resolveSpaceDefaultView, contextDefaultView, spaceHref } from './spaceDefaultView';

describe('resolveSpaceDefaultView', () => {
  it('la vue réglée sur l\'espace l\'emporte sur la communauté', () => {
    expect(resolveSpaceDefaultView('kanban', 'FORUM')).toBe('kanban');
  });

  it('sans vue réglée : celle du contexte de la communauté', () => {
    expect(resolveSpaceDefaultView(null, 'FORUM')).toBe('thread');
    expect(resolveSpaceDefaultView(undefined, 'PROJECT')).toBe('timeline');
    expect(resolveSpaceDefaultView('', 'JDR')).toBe('mindmap');
  });

  it('communauté neutre, espace personnel ou contexte inconnu : Liste', () => {
    expect(resolveSpaceDefaultView(null, null)).toBe('list');
    expect(resolveSpaceDefaultView(null, undefined)).toBe('list');
    expect(contextDefaultView('AUTRE')).toBe('list');
  });
});

describe('spaceHref', () => {
  const contexts = new Map<string, string | null>([['c-forum', 'FORUM'], ['c-neutre', null]]);

  it('porte la vue de l\'espace, sinon celle de sa communauté', () => {
    expect(spaceHref({ id: 's1', defaultView: 'kanban', communityId: 'c-forum' }, contexts)).toBe('/spaces/s1?view=kanban');
    expect(spaceHref({ id: 's2', defaultView: null, communityId: 'c-forum' }, contexts)).toBe('/spaces/s2?view=thread');
  });

  it('sans vue ni contexte : pas de ?view (la vue en cours est gardée)', () => {
    expect(spaceHref({ id: 's3', communityId: 'c-neutre' }, contexts)).toBe('/spaces/s3');
    expect(spaceHref({ id: 's4', communityId: null }, contexts)).toBe('/spaces/s4');
  });
});

/* TNR de spaceDefaultView : vue de l'espace d'abord, puis contexte de la communauté, puis Liste ; vue retirée → Liste. */
import { describe, it, expect } from 'vitest';
import { MODE_REGISTRY, getInterfaceMode } from '@spok/shared';
import { resolveSpaceDefaultView, contextDefaultView, spaceHref, knownViewOr, openingView } from './spaceDefaultView';

describe('knownViewOr', () => {
  it('garde une vue du registre ; l\'ancienne vue Présentation (overview, supprimée le 2026-11-13) ouvre la Liste', () => {
    expect(knownViewOr('tags')).toBe('tags');
    expect(knownViewOr('overview')).toBe('list');
  });
  it('vue retirée (bugs) ou absente : la Liste', () => {
    expect(knownViewOr('bugs')).toBe('list');
    expect(knownViewOr(null)).toBe('list');
  });
});

describe('resolveSpaceDefaultView', () => {
  it('la vue réglée sur l\'espace l\'emporte sur la communauté', () => {
    expect(resolveSpaceDefaultView('kanban', 'FORUM')).toBe('kanban');
  });

  // Valeurs attendues lues dans MODE_REGISTRY (openingView), jamais recopiées (centralisation, 2026-11-13)
  it.each(MODE_REGISTRY.filter((m) => m.context).map((m) => [m.context, m.openingView] as const))(
    'sans vue réglée, contexte %s : vue d\'ouverture %s du registre', (context, view) => {
      expect(resolveSpaceDefaultView(null, context)).toBe(view);
      expect(resolveSpaceDefaultView('', context)).toBe(view);
    });

  it('communauté neutre, espace personnel ou contexte inconnu : vue d\'ouverture du mode Tous', () => {
    const neutral = getInterfaceMode('tous').openingView;
    expect(resolveSpaceDefaultView(null, null)).toBe(neutral);
    expect(resolveSpaceDefaultView(null, undefined)).toBe(neutral);
    expect(contextDefaultView('AUTRE')).toBe(neutral);
  });
});

describe('spaceHref', () => {
  const contexts = new Map<string, string | null>([['c-forum', 'FORUM'], ['c-neutre', null]]);

  it('n\'impose jamais de vue (décision 2026-11-13 : la vue se décide à l\'ouverture)', () => {
    expect(spaceHref({ id: 's1', defaultView: 'kanban', communityId: 'c-forum' }, contexts)).toBe('/spaces/s1');
    expect(spaceHref({ id: 's2', defaultView: null, communityId: 'c-forum' }, contexts)).toBe('/spaces/s2');
    expect(spaceHref({ id: 's4', communityId: null }, contexts)).toBe('/spaces/s4');
  });
});

describe('openingView', () => {
  const base = { urlView: null, currentView: 'kanban', communityId: 'c1', defaultView: null, communityContext: 'FORUM' };

  it('même communauté : la vue en cours est gardée, même si l\'espace a sa propre vue d\'ouverture', () => {
    expect(openingView({ ...base, previousCommunityId: 'c1' })).toBe('kanban');
    expect(openingView({ ...base, previousCommunityId: 'c1', defaultView: 'timeline' })).toBe('kanban');
  });

  it('autre communauté ou premier espace ouvert : la vue d\'ouverture de l\'espace', () => {
    const forumOpening = getInterfaceMode('forum').openingView;
    expect(openingView({ ...base, previousCommunityId: 'c2' })).toBe(forumOpening);
    expect(openingView({ ...base, previousCommunityId: undefined, defaultView: 'timeline' })).toBe('timeline');
    expect(openingView({ ...base, previousCommunityId: null })).toBe(forumOpening);
  });

  it('espace personnel vers espace personnel : vue gardée', () => {
    expect(openingView({ ...base, communityId: null, communityContext: null, previousCommunityId: null })).toBe('kanban');
  });

  it('?view= de l\'adresse l\'emporte toujours ; vue retirée → Liste', () => {
    expect(openingView({ ...base, previousCommunityId: 'c1', urlView: 'mindmap' })).toBe('mindmap');
    expect(openingView({ ...base, previousCommunityId: 'c1', currentView: 'bugs' })).toBe('list');
  });
});

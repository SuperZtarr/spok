/* Tests de la portée par défaut de la recherche selon la page courante. */
import { describe, it, expect } from 'vitest';
import { buildSearchRoute, resolveMenuRoute } from './searchScope';

describe('buildSearchRoute', () => {
  it('espace (et ses sous-pages) → spaceId', () => {
    expect(buildSearchRoute('/spaces/abc')).toBe('/search?spaceId=abc');
    expect(buildSearchRoute('/spaces/abc/settings')).toBe('/search?spaceId=abc');
  });

  it('communauté → communityId', () => {
    expect(buildSearchRoute('/communities/c1')).toBe('/search?communityId=c1');
    expect(buildSearchRoute('/communities/c1/settings')).toBe('/search?communityId=c1');
  });

  it('listes et autres pages → sans portée', () => {
    expect(buildSearchRoute('/spaces')).toBe('/search');
    expect(buildSearchRoute('/communities')).toBe('/search');
    expect(buildSearchRoute('/today')).toBe('/search');
    expect(buildSearchRoute('/search')).toBe('/search');
  });
});

describe('resolveMenuRoute', () => {
  it('seule la clé search est enrichie', () => {
    expect(resolveMenuRoute('search', '/search', '/spaces/abc')).toBe('/search?spaceId=abc');
    expect(resolveMenuRoute('today', '/today', '/spaces/abc')).toBe('/today');
  });
});

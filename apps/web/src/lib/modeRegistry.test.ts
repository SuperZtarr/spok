/* Cohérence du registre des modes (centralisation des référentiels, 2026-11-13) : chaque favori et chaque vue
   d'ouverture existe dans VIEW_REGISTRY, chaque page masquée dans MENU_REGISTRY ; ids, libellés et contextes uniques.
   La correspondance contextes ↔ enum Prisma est vérifiée côté API (routes/communities.test.ts). */
import { describe, it, expect } from 'vitest';
import { MODE_REGISTRY, COMMUNITY_CONTEXTS, modeForContext, getInterfaceMode, VIEW_REGISTRY, MENU_REGISTRY } from '@spok/shared';

const viewIds = new Set(VIEW_REGISTRY.map((v) => v.id));
const menuKeys = new Set(MENU_REGISTRY.map((m) => m.key));

describe('MODE_REGISTRY', () => {
  it('ids, libellés et contextes uniques', () => {
    const uniq = (list: unknown[]) => new Set(list).size === list.length;
    expect(uniq(MODE_REGISTRY.map((m) => m.id))).toBe(true);
    expect(uniq(MODE_REGISTRY.map((m) => m.label))).toBe(true);
    expect(uniq(COMMUNITY_CONTEXTS as unknown as string[])).toBe(true);
  });

  it.each(MODE_REGISTRY.map((m) => [m.id, m] as const))('%s : favoris et vue d\'ouverture existent', (_id, mode) => {
    for (const v of mode.favorites) expect(viewIds.has(v)).toBe(true);
    expect(viewIds.has(mode.openingView)).toBe(true);
  });

  it.each(MODE_REGISTRY.map((m) => [m.id, m] as const))('%s : pages masquées existent dans le menu', (_id, mode) => {
    for (const key of mode.globalExcluded) expect(menuKeys.has(key)).toBe(true);
  });

  it('un seul mode sans contexte (Tous), mode par défaut', () => {
    expect(MODE_REGISTRY.filter((m) => m.context === null).map((m) => m.id)).toEqual(['tous']);
    expect(modeForContext(null)).toBe('tous');
    expect(modeForContext('INCONNU')).toBe('tous');
    expect(getInterfaceMode('inconnu').id).toBe('tous');
  });

  it('contexte → mode', () => {
    expect(modeForContext('FORUM')).toBe('forum');
    expect(modeForContext('JDR')).toBe('loisirs');
    expect(modeForContext('DOCUMENTATION')).toBe('documentation');
  });
});

/* Cohérence de MENU_REGISTRY côté pages globales (2026-11-18) : les pages qui couvrent tout SPOK sont dans la section
   « Tout SPOK » (overview), aucun libellé de page globale ne reprend celui d'une vue d'espace (confusion signalée par
   Thomas), et menuLabel lit le registre (erreur sur clé inconnue). */
import { describe, it, expect } from 'vitest';
import { MENU_REGISTRY, VIEW_REGISTRY, menuLabel } from '@spok/shared';

const OVERVIEW_KEYS = ['global-mindmap', 'global-sunburst', 'global-graph', 'global-links'];

describe('MENU_REGISTRY — pages globales', () => {
  it('les pages « Tout SPOK » sont dans la section overview', () => {
    const overview = MENU_REGISTRY.filter((m) => m.section === 'overview').map((m) => m.key).sort();
    expect(overview).toEqual([...OVERVIEW_KEYS].sort());
  });

  it('aucune page globale ne porte le libellé d\'une vue d\'espace', () => {
    const viewLabels = new Set(VIEW_REGISTRY.map((v) => v.label.toLowerCase()));
    const clashes = MENU_REGISTRY.filter((m) => !m.viewMode && m.section !== 'admin' && viewLabels.has(m.label.toLowerCase()));
    expect(clashes.map((m) => `${m.key} = ${m.label}`)).toEqual([]);
  });

  it('menuLabel renvoie le libellé du registre et refuse une clé inconnue', () => {
    expect(menuLabel('global-mindmap')).toBe(MENU_REGISTRY.find((m) => m.key === 'global-mindmap')!.label);
    expect(() => menuLabel('cle-inexistante')).toThrow();
  });
});

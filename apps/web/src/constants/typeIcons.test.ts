/* Contrôle des types d'élément côté web : toute icône citée par le registre (@spok/shared) est déclarée dans
   TYPE_ICON_COMPONENTS, toute teinte a ses classes dans la palette ; les tables dérivées couvrent tous les types. */
import { describe, it, expect } from 'vitest';
import { ITEM_TYPE_REGISTRY, ITEM_TYPES } from '@spok/shared';
import {
  TYPE_ICON_COMPONENTS, TYPE_HUE_PALETTE, TYPE_ICONS, TYPE_LABELS, TYPE_EMOJI, TYPE_GROUPS,
  getTypeHex, getTypeTextColor, getTypeLabel,
} from './ui';

describe('types d\'élément (registre → web)', () => {
  it.each(ITEM_TYPE_REGISTRY.map((t) => [t.id, t.icon, t.hue]))('%s : icône %s et teinte %s déclarées', (_id, icon, hue) => {
    expect(TYPE_ICON_COMPONENTS[icon]).toBeDefined();
    expect(TYPE_HUE_PALETTE[hue as keyof typeof TYPE_HUE_PALETTE]).toBeDefined();
  });

  it('chaque type a icône, libellé, emoji et un seul groupe', () => {
    for (const t of ITEM_TYPES) {
      expect(TYPE_ICONS[t]).toBeDefined();
      expect(TYPE_LABELS[t]).toBeTruthy();
      expect(TYPE_EMOJI[t]).toBeTruthy();
      expect(TYPE_GROUPS.filter((g) => g.types.includes(t))).toHaveLength(1);
    }
  });

  it('couleur et libellé suivent la communauté, sinon le registre', () => {
    expect(getTypeHex('TASK')).toBe(TYPE_HUE_PALETTE.green.hex);
    expect(getTypeTextColor('TASK')).toBe('text-green-500');
    const custom = { TASK: { label: 'Actions', labelShort: 'Action', color: 'border-red-400', bgHover: 'bg-red-50', visible: true, order: 0 } };
    expect(getTypeHex('TASK', custom)).toBe(TYPE_HUE_PALETTE.red.hex);
    expect(getTypeLabel('TASK', custom)).toBe('Action');
    expect(getTypeHex('INCONNU')).toBe(TYPE_HUE_PALETTE.gray.hex);
  });
});

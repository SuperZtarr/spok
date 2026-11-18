/* Couleur hexadécimale des statuts (getStatusHex, ui.ts) : chaque statut du référentiel doit sortir de la teinte
   de son badge, jamais du gris par défaut. Régression du 2026-11-18 : un caractère de contrôle dans la regex
   rendait toute la répartition par statut grise (tableau de bord, Flux cumulatif). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUSES } from '@spok/shared';
import { getStatusHex, TYPE_HUE_PALETTE } from './ui';

describe('getStatusHex', () => {
  it.each(DEFAULT_STATUSES.map((s) => [s.id, s.color] as const))('%s prend la teinte de son badge', (id, color) => {
    const hue = /bg-([a-z]+)-\d+/.exec(color)![1] as keyof typeof TYPE_HUE_PALETTE;
    expect(getStatusHex(id)).toBe(TYPE_HUE_PALETTE[hue].hex);
  });

  it('statut inconnu : gris', () => {
    expect(getStatusHex('inconnu')).toBe(TYPE_HUE_PALETTE.gray.hex);
  });
});

/* TNR du placement des infobulles d'aide (placeHint) : jamais hors de la fenêtre, au-dessus par défaut. */
import { describe, it, expect } from 'vitest';
import { placeHint } from './HelpHint';

const VW = 1000;
const VH = 600;
const anchorAt = (top: number, left = 480) => ({ top, bottom: top + 30, left, width: 40 });

describe('placeHint', () => {
  it('au-dessus de l\'élément quand la place suffit', () => {
    expect(placeHint(anchorAt(300), 200, 50, VW, VH)).toEqual({ left: 400, top: 244 });
  });

  it('en dessous quand un texte long ne tient pas au-dessus', () => {
    // élément à 200 px du haut, infobulle de 190 px : au-dessus elle sortirait de l'écran
    expect(placeHint(anchorAt(200), 260, 190, VW, VH).top).toBe(236);
  });

  it('ramenée dans la fenêtre quand elle ne tient d\'aucun côté', () => {
    const { top } = placeHint(anchorAt(250), 260, 400, VW, VH);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + 400).toBeLessThanOrEqual(VH - 8);
  });

  it('jamais coupée sur les bords gauche et droit', () => {
    expect(placeHint(anchorAt(300, 0), 260, 50, VW, VH).left).toBe(8);
    expect(placeHint(anchorAt(300, 990), 260, 50, VW, VH).left).toBe(VW - 8 - 260);
  });
});

/* Tests de la partie pure de la réduction d'image côté navigateur (calcul des dimensions, fichiers non réduits). */
import { computeTargetSize, shouldResize, IMAGE_RESIZE_MAX_DIMENSION } from './imageResize';

describe('computeTargetSize', () => {
  it("ne touche pas une image déjà dans la limite", () => {
    expect(computeTargetSize(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
  it('réduit en gardant les proportions (paysage)', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: IMAGE_RESIZE_MAX_DIMENSION, height: 1440 });
  });
  it('réduit en gardant les proportions (portrait)', () => {
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1440, height: IMAGE_RESIZE_MAX_DIMENSION });
  });
});

describe('shouldResize', () => {
  it('ne réduit jamais un GIF (animation perdue)', () => {
    expect(shouldResize('image/gif')).toBe(false);
  });
  it('réduit JPEG, PNG et WebP', () => {
    expect(shouldResize('image/jpeg')).toBe(true);
    expect(shouldResize('image/png')).toBe(true);
    expect(shouldResize('image/webp')).toBe(true);
  });
  it('ne réduit pas un fichier non image', () => {
    expect(shouldResize('application/pdf')).toBe(false);
  });
});

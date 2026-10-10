/*
 * Géométrie de la fenêtre « en direct » (position, taille, mode) : bornage dans l'écran et
 * persistance par navigateur (localStorage, tolérant aux erreurs — confort, pas une donnée).
 */
export type Geometry = { x: number; y: number; width: number; height: number; mode: 'normal' | 'minimized' | 'maximized' };

const KEY = 'spok.liveWindow';
const MIN_W = 280;
const MIN_H = 180;
export const DEFAULT_GEOMETRY: Geometry = { x: 24, y: 96, width: 480, height: 360, mode: 'normal' };

export function clampGeometry(g: Geometry, viewport: { width: number; height: number }): Geometry {
  const width = Math.min(Math.max(g.width, MIN_W), viewport.width);
  const height = Math.min(Math.max(g.height, MIN_H), viewport.height);
  const x = Math.min(Math.max(g.x, 0), viewport.width - width);
  const y = Math.min(Math.max(g.y, 0), viewport.height - height);
  return { ...g, x, y, width, height };
}

export function loadGeometry(): Geometry {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_GEOMETRY;
    const g = JSON.parse(raw);
    return typeof g?.x === 'number' && typeof g?.width === 'number' ? { ...DEFAULT_GEOMETRY, ...g } : DEFAULT_GEOMETRY;
  } catch { return DEFAULT_GEOMETRY; }
}

export function saveGeometry(g: Geometry): void {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* stockage indisponible */ }
}

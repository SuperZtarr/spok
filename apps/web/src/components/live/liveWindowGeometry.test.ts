/* Tests de la géométrie de la fenêtre en direct : bornage dans l'écran, persistance tolérante. */
import { describe, it, expect, beforeEach } from 'vitest'
import { clampGeometry, loadGeometry, saveGeometry, DEFAULT_GEOMETRY } from './liveWindowGeometry'

describe('liveWindowGeometry', () => {
  beforeEach(() => localStorage.clear())
  it('ramène la fenêtre dans l\'écran', () => {
    const g = clampGeometry({ x: 5000, y: -50, width: 3000, height: 200, mode: 'normal' }, { width: 1440, height: 900 })
    expect(g.width).toBeLessThanOrEqual(1440)
    expect(g.x + g.width).toBeLessThanOrEqual(1440)
    expect(g.y).toBeGreaterThanOrEqual(0)
  })
  it('impose une taille minimale', () => {
    const g = clampGeometry({ x: 0, y: 0, width: 10, height: 10, mode: 'normal' }, { width: 1440, height: 900 })
    expect(g.width).toBeGreaterThanOrEqual(280)
    expect(g.height).toBeGreaterThanOrEqual(180)
  })
  it('persiste et relit ; valeur corrompue → défaut', () => {
    saveGeometry({ ...DEFAULT_GEOMETRY, x: 42 })
    expect(loadGeometry().x).toBe(42)
    localStorage.setItem('spok.liveWindow', '{oops')
    expect(loadGeometry()).toEqual(DEFAULT_GEOMETRY)
  })
})

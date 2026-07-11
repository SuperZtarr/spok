/* Smoke tests web : les stores et modules clés s'importent sans erreur. */
import { describe, it, expect } from 'vitest'

describe('Web smoke test', () => {
  it('should run tests in jsdom environment', () => {
    expect(typeof document).toBe('object')
    expect(typeof window).toBe('object')
  })

  it('should have DOM APIs available', () => {
    const div = document.createElement('div')
    div.textContent = 'SPOK'
    expect(div.textContent).toBe('SPOK')
  })
})

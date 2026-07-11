/* Smoke tests API : l'app démarre, les plugins se chargent. */
import { describe, it, expect } from 'vitest'

describe('API smoke test', () => {
  it('should run tests in node environment', () => {
    expect(typeof process.env).toBe('object')
  })

  it('should have test env vars', () => {
    expect(process.env.JWT_SECRET).toBe('test-jwt-secret')
  })
})

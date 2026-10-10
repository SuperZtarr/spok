/* Tests des règles de verrou des copies de séance (itemLock). */
import { describe, it, expect } from 'vitest'
import { isLocked, lockedFieldViolations } from './itemLock.js'

describe('itemLock', () => {
  it('isLocked suit lockedAt', () => {
    expect(isLocked({ lockedAt: new Date() })).toBe(true)
    expect(isLocked({ lockedAt: null })).toBe(false)
    expect(isLocked(null)).toBe(false)
  })
  it('autorise seulement parentId, tagIds, updatedAt', () => {
    expect(lockedFieldViolations({ parentId: 'p', tagIds: [], updatedAt: '2026-10-10T00:00:00.000Z' })).toEqual([])
    expect(lockedFieldViolations({ status: 'done' })).toEqual(['status'])
    expect(lockedFieldViolations({ title: 'x', parentId: null })).toEqual(['title'])
  })
  it('ignore les clés undefined', () => {
    expect(lockedFieldViolations({ title: undefined, tagIds: ['t'] })).toEqual([])
  })
})

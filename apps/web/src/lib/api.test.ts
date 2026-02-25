import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError, isConflictError } from './api'

describe('ApiError', () => {
  it('should create an error with statusCode and message', () => {
    const err = new ApiError(404, 'Not found')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('ApiError')
    expect(err).toBeInstanceOf(Error)
  })

  it('should include details and code', () => {
    const err = new ApiError(409, 'Conflict', { field: 'email' }, 'DUPLICATE')
    expect(err.details).toEqual({ field: 'email' })
    expect(err.code).toBe('DUPLICATE')
  })

  it('should default details and code to undefined', () => {
    const err = new ApiError(500, 'Server error')
    expect(err.details).toBeUndefined()
    expect(err.code).toBeUndefined()
  })
})

describe('isConflictError', () => {
  it('should return true for a valid conflict error', () => {
    const err = new ApiError(409, 'Conflict', {
      code: 'CONFLICT_DETECTED',
      conflicts: [
        { field: 'title', label: 'Titre', serverValue: 'A', clientValue: 'B' },
      ],
      serverUpdatedAt: '2026-01-01T00:00:00Z',
    })
    expect(isConflictError(err)).toBe(true)
  })

  it('should return false for non-409 ApiError', () => {
    const err = new ApiError(400, 'Bad request', { code: 'CONFLICT_DETECTED' })
    expect(isConflictError(err)).toBe(false)
  })

  it('should return false for 409 without CONFLICT_DETECTED code', () => {
    const err = new ApiError(409, 'Conflict', { code: 'DUPLICATE' })
    expect(isConflictError(err)).toBe(false)
  })

  it('should return false for plain Error', () => {
    expect(isConflictError(new Error('oops'))).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isConflictError(null)).toBe(false)
    expect(isConflictError(undefined)).toBe(false)
  })

  it('should return false for non-error objects', () => {
    expect(isConflictError({ statusCode: 409 })).toBe(false)
    expect(isConflictError('string')).toBe(false)
  })
})

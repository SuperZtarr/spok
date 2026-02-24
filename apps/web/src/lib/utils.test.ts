import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateTime } from './utils'

describe('cn (class name merge)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
  })

  it('should merge tailwind conflicts', () => {
    // twMerge should resolve p-2 vs p-4
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('should handle empty input', () => {
    expect(cn()).toBe('')
  })

  it('should handle undefined/null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })
})

describe('formatDate', () => {
  it('should format a Date object in French short format', () => {
    const result = formatDate(new Date(2025, 0, 15)) // 15 Jan 2025
    expect(result).toMatch(/15/)
    expect(result).toMatch(/janv/)
    expect(result).toMatch(/2025/)
  })

  it('should format a string date', () => {
    const result = formatDate('2025-06-20T10:00:00')
    expect(result).toMatch(/20/)
    expect(result).toMatch(/juin/)
    expect(result).toMatch(/2025/)
  })
})

describe('formatDateTime', () => {
  it('should format with time', () => {
    const result = formatDateTime(new Date(2025, 2, 10, 14, 30)) // 10 Mar 2025 14:30
    expect(result).toMatch(/10/)
    expect(result).toMatch(/mars/)
    expect(result).toMatch(/2025/)
    expect(result).toMatch(/14/)
    expect(result).toMatch(/30/)
  })

  it('should format a string date with time', () => {
    const result = formatDateTime('2025-12-25T08:15:00')
    expect(result).toMatch(/25/)
    expect(result).toMatch(/déc/)
    expect(result).toMatch(/08/)
    expect(result).toMatch(/15/)
  })
})

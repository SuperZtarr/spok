import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from './useSort'

interface TestItem {
  name: string
  age: number
  date: Date | null
}

const items: TestItem[] = [
  { name: 'Charlie', age: 30, date: new Date('2026-03-01') },
  { name: 'Alice', age: 25, date: new Date('2026-01-01') },
  { name: 'Bob', age: 35, date: null },
]

const accessors: Record<string, (item: TestItem) => string | number | Date | null> = {
  name: (i) => i.name,
  age: (i) => i.age,
  date: (i) => i.date,
}

describe('useSort', () => {
  describe('initial state', () => {
    it('should use default key and asc order', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      expect(result.current.sortKey).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
    })

    it('should accept custom default order', () => {
      const { result } = renderHook(() => useSort<TestItem>('age', 'desc'))
      expect(result.current.sortOrder).toBe('desc')
    })
  })

  describe('toggle', () => {
    it('should toggle order when same key', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      act(() => result.current.toggle('name'))
      expect(result.current.sortOrder).toBe('desc')
    })

    it('should toggle back to asc on double toggle', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      act(() => result.current.toggle('name'))
      act(() => result.current.toggle('name'))
      expect(result.current.sortOrder).toBe('asc')
    })

    it('should switch key and reset to asc when different key', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      act(() => result.current.toggle('name')) // desc
      act(() => result.current.toggle('age'))  // new key → asc
      expect(result.current.sortKey).toBe('age')
      expect(result.current.sortOrder).toBe('asc')
    })
  })

  describe('sortData', () => {
    it('should sort strings alphabetically asc', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('should sort strings alphabetically desc', () => {
      const { result } = renderHook(() => useSort<TestItem>('name', 'desc'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted.map(i => i.name)).toEqual(['Charlie', 'Bob', 'Alice'])
    })

    it('should sort numbers asc', () => {
      const { result } = renderHook(() => useSort<TestItem>('age'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted.map(i => i.age)).toEqual([25, 30, 35])
    })

    it('should sort numbers desc', () => {
      const { result } = renderHook(() => useSort<TestItem>('age', 'desc'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted.map(i => i.age)).toEqual([35, 30, 25])
    })

    it('should put nulls at the end', () => {
      const { result } = renderHook(() => useSort<TestItem>('date'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted[sorted.length - 1].name).toBe('Bob')
    })

    it('should return data unchanged for unknown key', () => {
      const { result } = renderHook(() => useSort<TestItem>('unknown'))
      const sorted = result.current.sortData(items, accessors)
      expect(sorted).toEqual(items)
    })

    it('should not mutate original array', () => {
      const { result } = renderHook(() => useSort<TestItem>('name'))
      const original = [...items]
      result.current.sortData(items, accessors)
      expect(items).toEqual(original)
    })
  })
})

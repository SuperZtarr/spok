/*
 * TNR du hook useGlobalTaskFilters : dueDateParams (bug 2026-07-12 — "En retard" combiné
 * à Aujourd'hui/Semaine/Mois excluait à tort les tâches en retard selon l'ordre de clic).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGlobalTaskFilters } from './useGlobalTaskFilters'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z')) // mercredi
})
afterEach(() => vi.useRealTimers())

describe('useGlobalTaskFilters — dueDateParams', () => {
  it('overdue seul : pas de plancher, plafond = fin de la veille', () => {
    const { result } = renderHook(() => useGlobalTaskFilters())
    act(() => result.current.setSelectedDueDates(['overdue']))
    expect(result.current.queryParams.dueDateFrom).toBeUndefined()
    expect(result.current.queryParams.dueDateTo).toBeDefined()
  })

  it("today seul : plancher et plafond = aujourd'hui", () => {
    const { result } = renderHook(() => useGlobalTaskFilters())
    act(() => result.current.setSelectedDueDates(['today']))
    expect(result.current.queryParams.dueDateFrom).toBeDefined()
    expect(result.current.queryParams.dueDateTo).toBeDefined()
  })

  it('overdue + today, overdue coché EN PREMIER : pas de plancher (régression du bug)', () => {
    const { result } = renderHook(() => useGlobalTaskFilters())
    act(() => result.current.setSelectedDueDates((prev) => [...prev, 'overdue']))
    act(() => result.current.setSelectedDueDates((prev) => [...prev, 'today']))
    expect(result.current.selectedDueDates).toEqual(['overdue', 'today'])
    expect(result.current.queryParams.dueDateFrom).toBeUndefined()
  })

  it('overdue + today, today coché EN PREMIER : pas de plancher non plus (ordre indifférent)', () => {
    const { result } = renderHook(() => useGlobalTaskFilters())
    act(() => result.current.setSelectedDueDates((prev) => [...prev, 'today']))
    act(() => result.current.setSelectedDueDates((prev) => [...prev, 'overdue']))
    expect(result.current.selectedDueDates).toEqual(['today', 'overdue'])
    expect(result.current.queryParams.dueDateFrom).toBeUndefined()
  })

  it('week seul : plancher = aujourd\'hui', () => {
    const { result } = renderHook(() => useGlobalTaskFilters())
    act(() => result.current.setSelectedDueDates(['week']))
    expect(result.current.queryParams.dueDateFrom).toBeDefined()
  })
})

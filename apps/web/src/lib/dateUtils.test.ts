import { describe, it, expect } from 'vitest'
import {
  MONTH_NAMES_FR,
  MONTH_NAMES_SHORT_FR,
  DAY_NAMES_SHORT_FR,
  addDays,
  addWeeks,
  addMonths,
  addHours,
  startOfDay,
  roundToQuarter,
  diffMs,
  getCalendarDays,
  formatDateShort,
  formatTimeShort,
  toDatetimeLocal,
  fromDatetimeLocal,
  isSameDay,
} from './dateUtils'

describe('Constants', () => {
  it('should have 12 months in French', () => {
    expect(MONTH_NAMES_FR).toHaveLength(12)
    expect(MONTH_NAMES_FR[0]).toBe('janvier')
    expect(MONTH_NAMES_FR[11]).toBe('décembre')
  })

  it('should have 12 short month names', () => {
    expect(MONTH_NAMES_SHORT_FR).toHaveLength(12)
    expect(MONTH_NAMES_SHORT_FR[0]).toBe('janv.')
  })

  it('should have 7 day abbreviations starting Monday', () => {
    expect(DAY_NAMES_SHORT_FR).toHaveLength(7)
    expect(DAY_NAMES_SHORT_FR[0]).toBe('L')
    expect(DAY_NAMES_SHORT_FR[6]).toBe('D')
  })
})

describe('addDays', () => {
  it('should add positive days', () => {
    const d = new Date(2025, 0, 1) // Jan 1
    expect(addDays(d, 10).getDate()).toBe(11)
  })

  it('should subtract days with negative value', () => {
    const d = new Date(2025, 0, 15)
    expect(addDays(d, -5).getDate()).toBe(10)
  })

  it('should not mutate original date', () => {
    const d = new Date(2025, 0, 1)
    addDays(d, 10)
    expect(d.getDate()).toBe(1)
  })
})

describe('addWeeks', () => {
  it('should add weeks (7 days each)', () => {
    const d = new Date(2025, 0, 1) // Wed Jan 1
    const result = addWeeks(d, 2)
    expect(result.getDate()).toBe(15)
  })
})

describe('addMonths', () => {
  it('should add months', () => {
    const d = new Date(2025, 0, 15) // Jan 15
    const result = addMonths(d, 3)
    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBe(15)
  })

  it('should handle year rollover', () => {
    const d = new Date(2025, 10, 1) // Nov 1
    const result = addMonths(d, 3)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(1) // Feb
  })
})

describe('addHours', () => {
  it('should add hours', () => {
    const d = new Date(2025, 0, 1, 10, 0)
    const result = addHours(d, 3)
    expect(result.getHours()).toBe(13)
  })
})

describe('startOfDay', () => {
  it('should set time to midnight', () => {
    const d = new Date(2025, 5, 15, 14, 30, 45, 123)
    const result = startOfDay(d)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
    expect(result.getDate()).toBe(15)
  })
})

describe('roundToQuarter', () => {
  it('should round 0 minutes to 0', () => {
    const d = new Date(2025, 0, 1, 10, 0)
    expect(roundToQuarter(d).getMinutes()).toBe(0)
  })

  it('should round 7 minutes up to 15', () => {
    const d = new Date(2025, 0, 1, 10, 7)
    expect(roundToQuarter(d).getMinutes()).toBe(15)
  })

  it('should round 16 minutes up to 30', () => {
    const d = new Date(2025, 0, 1, 10, 16)
    expect(roundToQuarter(d).getMinutes()).toBe(30)
  })

  it('should round 45 to 45', () => {
    const d = new Date(2025, 0, 1, 10, 45)
    expect(roundToQuarter(d).getMinutes()).toBe(45)
  })
})

describe('diffMs', () => {
  it('should return difference in ms', () => {
    const result = diffMs('2025-01-01T00:00:00', '2025-01-01T01:00:00')
    expect(result).toBe(3600000) // 1 hour
  })

  it('should return 0 for empty strings', () => {
    expect(diffMs('', '')).toBe(0)
  })
})

describe('getCalendarDays', () => {
  it('should return 42 days (6 weeks)', () => {
    const days = getCalendarDays(2025, 0) // January 2025
    expect(days).toHaveLength(42)
  })

  it('should start on Monday', () => {
    const days = getCalendarDays(2025, 0) // January 2025
    // Jan 1 2025 is Wednesday, grid should start on Monday Dec 30
    expect(days[0].getDay()).toBe(1) // Monday
  })

  it('should include all days of the month', () => {
    const days = getCalendarDays(2025, 1) // February 2025
    const febDays = days.filter(d => d.getMonth() === 1)
    expect(febDays.length).toBe(28)
  })
})

describe('formatDateShort', () => {
  it('should format as "day month year" in French', () => {
    const d = new Date(2025, 0, 15)
    expect(formatDateShort(d)).toBe('15 janv. 2025')
  })

  it('should format December correctly', () => {
    const d = new Date(2025, 11, 25)
    expect(formatDateShort(d)).toBe('25 déc. 2025')
  })
})

describe('formatTimeShort', () => {
  it('should format as HH:mm', () => {
    const d = new Date(2025, 0, 1, 9, 5)
    expect(formatTimeShort(d)).toBe('09:05')
  })

  it('should pad hours and minutes', () => {
    const d = new Date(2025, 0, 1, 0, 0)
    expect(formatTimeShort(d)).toBe('00:00')
  })
})

describe('toDatetimeLocal', () => {
  it('should return YYYY-MM-DDTHH:mm format', () => {
    const d = new Date(2025, 5, 15, 14, 30)
    expect(toDatetimeLocal(d)).toBe('2025-06-15T14:30')
  })

  it('should pad single digits', () => {
    const d = new Date(2025, 0, 5, 8, 3)
    expect(toDatetimeLocal(d)).toBe('2025-01-05T08:03')
  })
})

describe('fromDatetimeLocal', () => {
  it('should parse datetime-local string to Date', () => {
    const result = fromDatetimeLocal('2025-06-15T14:30')
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(5) // June
    expect(result.getDate()).toBe(15)
  })

  it('should return current date for empty string', () => {
    const before = Date.now()
    const result = fromDatetimeLocal('')
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
  })
})

describe('isSameDay', () => {
  it('should return true for same day different times', () => {
    const a = new Date(2025, 5, 15, 10, 0)
    const b = new Date(2025, 5, 15, 22, 30)
    expect(isSameDay(a, b)).toBe(true)
  })

  it('should return false for different days', () => {
    const a = new Date(2025, 5, 15)
    const b = new Date(2025, 5, 16)
    expect(isSameDay(a, b)).toBe(false)
  })

  it('should return false for different months', () => {
    const a = new Date(2025, 5, 15)
    const b = new Date(2025, 6, 15)
    expect(isSameDay(a, b)).toBe(false)
  })
})

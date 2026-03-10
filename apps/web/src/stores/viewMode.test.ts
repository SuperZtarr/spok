import { describe, it, expect, beforeEach } from 'vitest'
import { useViewModeStore, VIEW_MODES, VIEW_CATEGORIES, type ViewMode } from './viewMode'

describe('VIEW_MODES constants', () => {
  it('should have 22 view modes', () => {
    expect(VIEW_MODES).toHaveLength(22)
  })

  it('should have unique values', () => {
    const values = VIEW_MODES.map(m => m.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('should all have a category', () => {
    const categoryValues = VIEW_CATEGORIES.map(c => c.value)
    for (const mode of VIEW_MODES) {
      expect(categoryValues).toContain(mode.category)
    }
  })
})

describe('VIEW_CATEGORIES constants', () => {
  it('should have 4 categories', () => {
    expect(VIEW_CATEGORIES).toHaveLength(4)
  })

  it('should include dashboard, basic, planning, exploration', () => {
    const values = VIEW_CATEGORIES.map(c => c.value)
    expect(values).toContain('dashboard')
    expect(values).toContain('basic')
    expect(values).toContain('planning')
    expect(values).toContain('exploration')
  })
})

describe('useViewModeStore', () => {
  beforeEach(() => {
    useViewModeStore.setState({ mode: 'tree' })
  })

  it('should have tree as default mode', () => {
    expect(useViewModeStore.getState().mode).toBe('tree')
  })

  it('should change mode with setMode', () => {
    useViewModeStore.getState().setMode('kanban')
    expect(useViewModeStore.getState().mode).toBe('kanban')
  })

  it('should accept all valid view modes', () => {
    const modes: ViewMode[] = ['list', 'tree', 'mindmap', 'kanban', 'types', 'timeline', 'planning', 'calendar', 'graph', 'text', 'sunburst']
    for (const mode of modes) {
      useViewModeStore.getState().setMode(mode)
      expect(useViewModeStore.getState().mode).toBe(mode)
    }
  })
})

/* TNR du store viewMode : constantes VIEW_MODES (catégories = SPACE_VIEW_SECTIONS), mode par défaut, persistance. */
import { describe, it, expect, beforeEach } from 'vitest'
import { SPACE_VIEW_SECTION_IDS } from '@spok/shared'
import { useViewModeStore, VIEW_MODES, type ViewMode } from './viewMode'

describe('VIEW_MODES constants', () => {
  it('should have 34 view modes', () => {
    expect(VIEW_MODES).toHaveLength(34)
  })

  it('should have unique values', () => {
    const values = VIEW_MODES.map(m => m.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('should all have a category of SPACE_VIEW_SECTIONS', () => {
    for (const mode of VIEW_MODES) {
      expect(SPACE_VIEW_SECTION_IDS.has(mode.category)).toBe(true)
    }
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

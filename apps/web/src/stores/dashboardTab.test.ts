import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardTabStore, DASHBOARD_TABS, type DashboardTab } from './dashboardTab'

describe('useDashboardTabStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useDashboardTabStore.setState({ tab: 'spaces' })
  })

  it('should default to spaces tab', () => {
    expect(useDashboardTabStore.getState().tab).toBe('spaces')
  })

  it('should set tab to graph', () => {
    useDashboardTabStore.getState().setTab('graph')
    expect(useDashboardTabStore.getState().tab).toBe('graph')
  })

  it('should set tab to sunburst', () => {
    useDashboardTabStore.getState().setTab('sunburst')
    expect(useDashboardTabStore.getState().tab).toBe('sunburst')
  })

  it('should set tab to mindmap', () => {
    useDashboardTabStore.getState().setTab('mindmap')
    expect(useDashboardTabStore.getState().tab).toBe('mindmap')
  })

  it('should persist to localStorage', () => {
    useDashboardTabStore.getState().setTab('graph')
    const stored = localStorage.getItem('dashboard-tab-storage')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.tab).toBe('graph')
  })
})

describe('DASHBOARD_TABS', () => {
  it('should have 7 tabs', () => {
    expect(DASHBOARD_TABS).toHaveLength(7)
  })

  it('should contain home, communities, spaces, sunburst, mindmap, graph, planning', () => {
    const values = DASHBOARD_TABS.map(t => t.value)
    expect(values).toContain('home')
    expect(values).toContain('communities')
    expect(values).toContain('spaces')
    expect(values).toContain('graph')
    expect(values).toContain('sunburst')
    expect(values).toContain('mindmap')
    expect(values).toContain('planning')
  })

  it('should have label and icon for each tab', () => {
    DASHBOARD_TABS.forEach(tab => {
      expect(tab.label).toBeTruthy()
      expect(tab.icon).toBeTruthy()
    })
  })
})

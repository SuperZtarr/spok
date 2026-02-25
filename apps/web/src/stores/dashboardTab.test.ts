import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardTabStore, DASHBOARD_TABS, DASHBOARD_NAV_ITEMS, type DashboardTab } from './dashboardTab'

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
  it('should have 4 tabs', () => {
    expect(DASHBOARD_TABS).toHaveLength(4)
  })

  it('should contain all expected tab values', () => {
    const values = DASHBOARD_TABS.map(t => t.value)
    expect(values).toEqual(['spaces', 'graph', 'sunburst', 'mindmap'])
  })

  it('should have label and icon for each tab', () => {
    DASHBOARD_TABS.forEach(tab => {
      expect(tab.label).toBeTruthy()
      expect(tab.icon).toBeTruthy()
    })
  })
})

describe('DASHBOARD_NAV_ITEMS', () => {
  it('should have at least 1 nav item', () => {
    expect(DASHBOARD_NAV_ITEMS.length).toBeGreaterThanOrEqual(1)
  })

  it('should have route for each nav item', () => {
    DASHBOARD_NAV_ITEMS.forEach(item => {
      expect(item.route).toMatch(/^\//)
    })
  })
})

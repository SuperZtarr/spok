import { describe, it, expect, beforeEach } from 'vitest'
import { useCommunityStore } from './community'

const mockCommunity = {
  id: 'comm-1',
  name: 'Test Community',
  slug: 'test-community',
  isPublic: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  _count: { members: 5, spaces: 3 },
  role: 'ADMIN' as const,
}

describe('useCommunityStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useCommunityStore.setState({ currentCommunity: null })
  })

  it('should start with null currentCommunity', () => {
    expect(useCommunityStore.getState().currentCommunity).toBeNull()
  })

  it('should set currentCommunity', () => {
    useCommunityStore.getState().setCurrentCommunity(mockCommunity)
    expect(useCommunityStore.getState().currentCommunity).toEqual(mockCommunity)
  })

  it('should clear currentCommunity with null', () => {
    useCommunityStore.getState().setCurrentCommunity(mockCommunity)
    useCommunityStore.getState().setCurrentCommunity(null)
    expect(useCommunityStore.getState().currentCommunity).toBeNull()
  })

  it('should replace currentCommunity when setting a new one', () => {
    useCommunityStore.getState().setCurrentCommunity(mockCommunity)
    const other = { ...mockCommunity, id: 'comm-2', name: 'Other' }
    useCommunityStore.getState().setCurrentCommunity(other)
    expect(useCommunityStore.getState().currentCommunity?.id).toBe('comm-2')
  })

  it('should persist to localStorage', () => {
    useCommunityStore.getState().setCurrentCommunity(mockCommunity)
    const stored = localStorage.getItem('community-storage')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.currentCommunity.id).toBe('comm-1')
  })
})

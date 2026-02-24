import { describe, it, expect, beforeEach } from 'vitest'
import { useSpaceStore } from './space'

const mockSpace = {
  id: 'space-1',
  name: 'Test Space',
  type: 'GROUP' as const,
  role: 'OWNER' as const,
  communityId: null,
  parentId: null,
  avatarUrl: null,
  coverUrl: null,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
}

describe('useSpaceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSpaceStore.setState({
      currentSpace: null,
      includeChildrenSpaceIds: new Set(),
    })
  })

  describe('currentSpace', () => {
    it('should start with null', () => {
      expect(useSpaceStore.getState().currentSpace).toBeNull()
    })

    it('should set current space', () => {
      useSpaceStore.getState().setCurrentSpace(mockSpace)
      expect(useSpaceStore.getState().currentSpace).toEqual(mockSpace)
    })

    it('should clear current space with null', () => {
      useSpaceStore.getState().setCurrentSpace(mockSpace)
      useSpaceStore.getState().setCurrentSpace(null)
      expect(useSpaceStore.getState().currentSpace).toBeNull()
    })
  })

  describe('toggleIncludeChildren', () => {
    it('should add a space id', () => {
      useSpaceStore.getState().toggleIncludeChildren('child-1')
      expect(useSpaceStore.getState().includeChildrenSpaceIds.has('child-1')).toBe(true)
    })

    it('should remove a space id when toggled again', () => {
      useSpaceStore.getState().toggleIncludeChildren('child-1')
      useSpaceStore.getState().toggleIncludeChildren('child-1')
      expect(useSpaceStore.getState().includeChildrenSpaceIds.has('child-1')).toBe(false)
    })

    it('should add all descendant ids when toggling on', () => {
      useSpaceStore.getState().toggleIncludeChildren('parent', ['child-1', 'child-2'])
      const ids = useSpaceStore.getState().includeChildrenSpaceIds
      expect(ids.has('parent')).toBe(true)
      expect(ids.has('child-1')).toBe(true)
      expect(ids.has('child-2')).toBe(true)
    })

    it('should remove all descendant ids when toggling off', () => {
      useSpaceStore.getState().toggleIncludeChildren('parent', ['child-1', 'child-2'])
      useSpaceStore.getState().toggleIncludeChildren('parent', ['child-1', 'child-2'])
      const ids = useSpaceStore.getState().includeChildrenSpaceIds
      expect(ids.has('parent')).toBe(false)
      expect(ids.has('child-1')).toBe(false)
      expect(ids.has('child-2')).toBe(false)
    })

    it('should persist to localStorage', () => {
      useSpaceStore.getState().toggleIncludeChildren('child-1')
      const stored = localStorage.getItem('spok:includeChildrenSpaceIds')
      expect(stored).toBeTruthy()
      expect(JSON.parse(stored!)).toContain('child-1')
    })
  })
})

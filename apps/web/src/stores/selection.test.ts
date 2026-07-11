/* TNR du store selection : toggle, sélection multiple, sortie du mode sélection. */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore } from './selection'

describe('useSelectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSelectionStore.setState({
      selectedIds: new Set(),
      isSelectionMode: false,
    })
  })

  describe('toggleSelection', () => {
    it('should add an item to selection', () => {
      useSelectionStore.getState().toggleSelection('item-1')
      expect(useSelectionStore.getState().selectedIds.has('item-1')).toBe(true)
    })

    it('should remove an already selected item', () => {
      useSelectionStore.getState().toggleSelection('item-1')
      useSelectionStore.getState().toggleSelection('item-1')
      expect(useSelectionStore.getState().selectedIds.has('item-1')).toBe(false)
    })

    it('should handle multiple items', () => {
      useSelectionStore.getState().toggleSelection('item-1')
      useSelectionStore.getState().toggleSelection('item-2')
      const ids = useSelectionStore.getState().selectedIds
      expect(ids.size).toBe(2)
      expect(ids.has('item-1')).toBe(true)
      expect(ids.has('item-2')).toBe(true)
    })
  })

  describe('selectItem', () => {
    it('should add an item', () => {
      useSelectionStore.getState().selectItem('item-1')
      expect(useSelectionStore.getState().selectedIds.has('item-1')).toBe(true)
    })

    it('should not remove when called twice', () => {
      useSelectionStore.getState().selectItem('item-1')
      useSelectionStore.getState().selectItem('item-1')
      expect(useSelectionStore.getState().selectedIds.has('item-1')).toBe(true)
    })
  })

  describe('deselectItem', () => {
    it('should remove an item', () => {
      useSelectionStore.getState().selectItem('item-1')
      useSelectionStore.getState().deselectItem('item-1')
      expect(useSelectionStore.getState().selectedIds.has('item-1')).toBe(false)
    })

    it('should be no-op for non-selected item', () => {
      useSelectionStore.getState().deselectItem('item-99')
      expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    })
  })

  describe('selectAll', () => {
    it('should replace selection with given ids', () => {
      useSelectionStore.getState().selectItem('old')
      useSelectionStore.getState().selectAll(['a', 'b', 'c'])
      const ids = useSelectionStore.getState().selectedIds
      expect(ids.size).toBe(3)
      expect(ids.has('old')).toBe(false)
      expect(ids.has('a')).toBe(true)
    })
  })

  describe('clearSelection', () => {
    it('should clear all selected items', () => {
      useSelectionStore.getState().selectAll(['a', 'b'])
      useSelectionStore.getState().clearSelection()
      expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    })

    it('should also disable selection mode', () => {
      useSelectionStore.getState().setSelectionMode(true)
      useSelectionStore.getState().clearSelection()
      expect(useSelectionStore.getState().isSelectionMode).toBe(false)
    })
  })

  describe('toggleSelectionMode', () => {
    it('should enable selection mode', () => {
      useSelectionStore.getState().toggleSelectionMode()
      expect(useSelectionStore.getState().isSelectionMode).toBe(true)
    })

    it('should disable and clear selection when toggling off', () => {
      useSelectionStore.getState().toggleSelectionMode() // on
      useSelectionStore.getState().selectAll(['a', 'b'])
      useSelectionStore.getState().toggleSelectionMode() // off
      expect(useSelectionStore.getState().isSelectionMode).toBe(false)
      expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    })
  })

  describe('setSelectionMode', () => {
    it('should enable with empty selection', () => {
      useSelectionStore.getState().setSelectionMode(true)
      expect(useSelectionStore.getState().isSelectionMode).toBe(true)
      expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    })

    it('should disable and clear selection', () => {
      useSelectionStore.getState().selectAll(['a'])
      useSelectionStore.getState().setSelectionMode(false)
      expect(useSelectionStore.getState().isSelectionMode).toBe(false)
      expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    })
  })
})

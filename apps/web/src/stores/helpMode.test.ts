/* Tests du store du mode Aide : bascule, et refus d'entrer pendant un tour guidé. */
import { describe, it, expect, beforeEach } from 'vitest'
import { useHelpModeStore } from './helpMode'

describe('useHelpModeStore', () => {
  beforeEach(() => { useHelpModeStore.setState({ active: false }); document.body.innerHTML = '' })

  it('enter / exit / toggle', () => {
    useHelpModeStore.getState().enter()
    expect(useHelpModeStore.getState().active).toBe(true)
    useHelpModeStore.getState().toggle()
    expect(useHelpModeStore.getState().active).toBe(false)
    useHelpModeStore.getState().toggle()
    useHelpModeStore.getState().exit()
    expect(useHelpModeStore.getState().active).toBe(false)
  })

  it('n\'entre pas pendant un tour guidé', () => {
    document.body.innerHTML = '<div class="driver-popover"></div>'
    useHelpModeStore.getState().enter()
    expect(useHelpModeStore.getState().active).toBe(false)
  })
})

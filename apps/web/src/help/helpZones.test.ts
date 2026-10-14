/* Tests de la résolution des zones du mode Aide : devzone du cadre, zone de vue, zone sans texte traversée. */
import { describe, it, expect } from 'vitest'
import { findHelpZone, zoneText } from './helpZones'
import { SHELL_ZONES } from './shellZones'
import { VIEW_HELP } from '../components/views/help'

describe('helpZones', () => {
  it('zoneText : devzone du cadre et zone de vue', () => {
    expect(zoneText('sidebar')).toEqual(SHELL_ZONES.sidebar)
    VIEW_HELP.list.zones = { ...(VIEW_HELP.list.zones ?? {}), testzone: { title: 'T', text: 'X' } }
    expect(zoneText('list:testzone')).toEqual({ title: 'T', text: 'X' })
    expect(zoneText('list:inconnue')).toBeUndefined()
    expect(zoneText('inconnue')).toBeUndefined()
  })

  it('findHelpZone : la plus interne ayant un texte, sinon le parent', () => {
    document.body.innerHTML = `
      <aside data-devzone="sidebar">
        <div data-devzone="zone-sans-texte"><button id="b">x</button></div>
        <div data-help-zone="list:testzone"><span id="s">y</span></div>
      </aside>`
    expect(findHelpZone(document.getElementById('b'))?.id).toBe('sidebar')
    expect(findHelpZone(document.getElementById('s'))?.id).toBe('list:testzone')
    expect(findHelpZone(document.body)).toBeNull()
  })
})

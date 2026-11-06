/* Tests de la résolution des zones du mode Aide : devzone du cadre, zone de vue, zone sans texte traversée, rappel de commande. */
import { describe, it, expect } from 'vitest'
import { findHelpZone, zoneText } from './helpZones'
import { SHELL_ZONES } from './shellZones'
import { TOUCH_HELP } from './touch'
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

  it('findHelpZone : le rappel d\'une commande passe avant sa zone, titré par la commande', () => {
    document.body.innerHTML = `
      <aside data-devzone="sidebar">
        <span data-help-hint="Rappel A"><button id="a" aria-label="Supprimer"><svg></svg></button></span>
        <span data-help-hint="Rappel B"><button id="b">Fusionner</button></span>
        <span data-help-hint="Rappel C"><select id="c"><option>Jour</option><option>Mois</option></select></span>
        <span data-help-hint="Rappel D"><button id="d"><svg></svg></button></span>
      </aside>`
    expect(findHelpZone(document.getElementById('a'))?.zone).toEqual({ title: 'Supprimer', text: 'Rappel A' })
    expect(findHelpZone(document.getElementById('b'))?.zone).toEqual({ title: 'Fusionner', text: 'Rappel B' })
    expect(findHelpZone(document.getElementById('c'))?.zone).toEqual({ title: TOUCH_HELP.genericCommand, text: 'Rappel C' })
    expect(findHelpZone(document.getElementById('d'))?.zone).toEqual({ title: TOUCH_HELP.genericCommand, text: 'Rappel D' })
  })
})

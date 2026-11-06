/* TNR du toucher sur HelpHint : l'appui court déclenche l'action sans infobulle, l'appui long affiche le rappel sans
   déclencher l'action, glisser le doigt annule, le survol à la souris ne change pas. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen } from '@testing-library/react'
import { HelpHint } from './HelpHint'
import { useHelpModeStore } from '../stores/helpMode'

const at = (x = 10, y = 10) => ({ touches: [{ clientX: x, clientY: y }] })
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

function setup() {
  const onClick = vi.fn()
  render(<HelpHint text="Supprime l'élément"><button onClick={onClick}>Action</button></HelpHint>)
  return { onClick, button: screen.getByText('Action') }
}

/** Ce que le navigateur envoie après un appui court : événements souris simulés, focus, clic */
function emulatedTap(button: HTMLElement) {
  fireEvent.touchEnd(button)
  fireEvent.mouseEnter(button.parentElement!)
  fireEvent.mouseDown(button)
  fireEvent.focus(button)
  fireEvent.click(button)
}

describe('HelpHint au toucher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    act(() => useHelpModeStore.setState({ active: false }))
  })
  afterEach(() => { vi.useRealTimers() })

  it('appui court : l\'action part, aucune infobulle, même après le focus simulé', () => {
    const { onClick, button } = setup()
    fireEvent.touchStart(button, at())
    wait(100)
    emulatedTap(button)
    wait(1000)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('appui long : le rappel s\'affiche et l\'action ne part pas', () => {
    const { onClick, button } = setup()
    fireEvent.touchStart(button, at())
    wait(450)
    expect(screen.getByRole('tooltip').textContent).toBe('Supprime l\'élément')
    fireEvent.touchEnd(button)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('le rappel reste après le relâchement et se ferme au toucher suivant, dont l\'appui court agit', () => {
    const { onClick, button } = setup()
    fireEvent.touchStart(button, at())
    wait(450)
    fireEvent.touchEnd(button)
    wait(3000)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.touchStart(button, at())
    expect(screen.queryByRole('tooltip')).toBeNull()
    wait(100)
    emulatedTap(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('glisser le doigt annule l\'appui long : un défilement n\'affiche rien', () => {
    const { button } = setup()
    fireEvent.touchStart(button, at())
    fireEvent.touchMove(button, at(10, 40))
    wait(1000)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('appui long sous Android : le menu contextuel est remplacé par le rappel', () => {
    const { button } = setup()
    fireEvent.touchStart(button, at())
    wait(300)
    const notPrevented = fireEvent.contextMenu(button)
    expect(notPrevented).toBe(false)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('en mode Aide, l\'appui long n\'affiche pas d\'infobulle : le mode gère le toucher', () => {
    const { button } = setup()
    act(() => useHelpModeStore.setState({ active: true }))
    fireEvent.touchStart(button, at())
    wait(1000)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('souris : survol inchangé, le rappel paraît puis disparaît à la sortie', () => {
    const { button } = setup()
    fireEvent.mouseEnter(button.parentElement!)
    wait(250)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(button.parentElement!)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

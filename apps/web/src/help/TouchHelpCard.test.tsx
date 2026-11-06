/* TNR de la carte de première visite sur écran tactile : seulement sans survol, une fois par appareil, et le mode Aide
   s'ouvre depuis la carte. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen } from '@testing-library/react'
import { TouchHelpCard, TOUCH_HELP_SEEN_KEY } from './TouchHelpCard'
import { TOUCH_HELP } from './touch'
import { useHelpModeStore } from '../stores/helpMode'

const withHover = (hover: boolean) => {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: !hover && query === '(hover: none)' }) as MediaQueryList)
}
const appear = () => act(() => { vi.advanceTimersByTime(2000) })

describe('TouchHelpCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.removeItem(TOUCH_HELP_SEEN_KEY)
    act(() => useHelpModeStore.setState({ active: false }))
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('écran tactile, première visite : la carte s\'affiche', () => {
    withHover(false)
    render(<TouchHelpCard />)
    appear()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('avec une souris : pas de carte', () => {
    withHover(true)
    render(<TouchHelpCard />)
    appear()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('« Compris » : plus de carte aux visites suivantes, mode Aide fermé', () => {
    withHover(false)
    const { unmount } = render(<TouchHelpCard />)
    appear()
    fireEvent.click(screen.getByText(TOUCH_HELP.cardDismiss))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useHelpModeStore.getState().active).toBe(false)
    unmount()
    render(<TouchHelpCard />)
    appear()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('« Essayer » : ouvre le mode Aide et marque la carte comme vue', () => {
    withHover(false)
    render(<TouchHelpCard />)
    appear()
    fireEvent.click(screen.getByText(TOUCH_HELP.cardTry))
    expect(useHelpModeStore.getState().active).toBe(true)
    expect(localStorage.getItem(TOUCH_HELP_SEEN_KEY)).toBe('true')
  })

  it('sans réponse, la carte revient à la visite suivante', () => {
    withHover(false)
    const { unmount } = render(<TouchHelpCard />)
    appear()
    unmount()
    render(<TouchHelpCard />)
    appear()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

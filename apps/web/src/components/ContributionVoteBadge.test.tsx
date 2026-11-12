/* Tests du vote affiché sur une contribution (ContributionVoteBadge, règle contribution-vote-kept) : rien sans vote,
 * emoji + libellé du référentiel, préfixe « Votre vote » pendant la saisie, id brut pour un vote inconnu. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContributionVoteBadge, voteLabel } from './ContributionVoteBadge'

describe('ContributionVoteBadge', () => {
  it('ne rend rien sans vote (anciennes contributions)', () => {
    const { container } = render(<ContributionVoteBadge type={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('affiche emoji et libellé du vote', () => {
    render(<ContributionVoteBadge type="trollage" />)
    const badge = screen.getByTestId('contribution-vote')
    expect(badge.textContent).toContain('🤡')
    expect(badge.textContent).toContain('Trollage')
    expect(badge.textContent).not.toContain('Votre vote')
  })

  it('en saisie : préfixe « Votre vote : »', () => {
    render(<ContributionVoteBadge type="pertinent" pending />)
    expect(screen.getByTestId('contribution-vote').textContent).toContain('Votre vote :')
  })

  it('vote inconnu : id brut, sans emoji', () => {
    expect(voteLabel('autre')).toEqual({ emoji: '', label: 'autre' })
  })
})

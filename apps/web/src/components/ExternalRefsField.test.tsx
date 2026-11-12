/* Tests des références externes côté web (ExternalRefsField, règle item-external-refs) : affichage « Appli : Réf | … »
 * avec le nom de l'outil en gras, saisie normalisée en quittant le champ, aperçu, résumé et copie de la fiche. */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ExternalRefsList, ExternalRefsInput } from './ExternalRefsField'
import { buildForumSummary } from './item-edit-helpers'

describe('ExternalRefsList', () => {
  it('rien sans référence', () => {
    const { container } = render(<ExternalRefsList refs={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('nom de l\'outil en gras, « | » entre deux entrées', () => {
    render(<ExternalRefsList refs={['Appli1 : Ref1', 'ref2']} />)
    const list = screen.getByTestId('external-refs')
    expect(list.textContent).toBe('Appli1 : Ref1|ref2')
    expect(list.querySelector('.font-semibold')?.textContent).toBe('Appli1')
  })
})

describe('ExternalRefsInput', () => {
  it('quitter le champ remet la saisie au propre', () => {
    const onChange = vi.fn()
    render(<ExternalRefsInput value="Appli1:Ref1|appli2  :  ref2|" onChange={onChange} />)
    fireEvent.blur(screen.getByLabelText('Références externes'))
    expect(onChange).toHaveBeenCalledWith('Appli1 : Ref1 | appli2 : ref2')
  })

  it('saisie déjà propre : pas d\'appel', () => {
    const onChange = vi.fn()
    render(<ExternalRefsInput value="Jira : A" onChange={onChange} />)
    fireEvent.blur(screen.getByLabelText('Références externes'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('buildForumSummary', () => {
  it('compte les références externes', () => {
    const labels = { typeLabel: () => undefined, statusLabel: () => undefined, priorityLabel: () => undefined, formatDate: (d: string) => d }
    expect(buildForumSummary({ externalRefs: ['A : 1', 'B : 2'] }, labels)).toEqual(['2 réf. externes'])
  })
})

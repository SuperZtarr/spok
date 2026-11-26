/* Tests du découpage partagé d'une description par titres (@spok/shared descriptionSections) : source unique de
   l'aperçu de la modale « Éclater en sous-éléments » et de la route POST /items/:id/split. */
import { describe, it, expect } from 'vitest'
import { splitDescriptionSections, planDescriptionSplit, hasDescriptionHeadings } from '@spok/shared'

const html = '<p>Intro</p><h2>Alpha</h2><p>a</p><h3><strong>Beta</strong></h3><p>b</p><h2>Gamma</h2>'

describe('splitDescriptionSections', () => {
  it('sépare le texte d\'avant et une section par titre H2/H3', () => {
    const { preContent, sections } = splitDescriptionSections(html)
    expect(preContent).toBe('<p>Intro</p>')
    expect(sections.map((s) => s.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sections[1].headingHtml).toBe('<h3><strong>Beta</strong></h3>')
    expect(sections[1].body).toBe('<p>b</p>')
    expect(sections[2].body).toBe('')
  })

  it('sans titre : aucune section', () => {
    expect(splitDescriptionSections('<p>x</p><h1>Titre 1</h1>').sections).toEqual([])
    expect(hasDescriptionHeadings('<p>x</p>')).toBe(false)
    expect(hasDescriptionHeadings(html)).toBe(true)
  })
})

describe('planDescriptionSplit', () => {
  it('sans choix : toutes les sections deviennent des sous-éléments', () => {
    const plan = planDescriptionSplit(html)
    expect(plan.children).toEqual([
      { title: 'Alpha', description: '<p>a</p>' },
      { title: 'Beta', description: '<p>b</p>' },
      { title: 'Gamma', description: null },
    ])
    expect(plan.parentDescription).toBe('<p>Intro</p>')
  })

  it('sections non choisies : restent dans la description, titre compris, à leur place', () => {
    const plan = planDescriptionSplit(html, [1])
    expect(plan.children).toEqual([{ title: 'Beta', description: '<p>b</p>' }])
    expect(plan.parentDescription).toBe('<p>Intro</p><h2>Alpha</h2><p>a</p><h2>Gamma</h2>')
  })

  it('tout éclaté sans texte d\'avant : description vidée', () => {
    expect(planDescriptionSplit('<h2>A</h2><p>a</p>').parentDescription).toBeNull()
  })
})

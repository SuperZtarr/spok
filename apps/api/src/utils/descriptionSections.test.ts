/* Tests du découpage partagé d'une description par titres (@spok/shared descriptionSections) : source unique de
   l'aperçu de la modale « Éclater en sous-éléments » et de la route POST /items/:id/split. Premier niveau = H2 ;
   les H3 restent dans leur section sauf s'ils sont choisis (demande Thomas 2026-11-27). */
import { describe, it, expect } from 'vitest'
import { splitDescriptionSections, planDescriptionSplit, hasDescriptionHeadings } from '@spok/shared'

const html = '<p>Intro</p><h3>Avant</h3><p>x</p><h2>Alpha</h2><p>a</p><h3><strong>Beta</strong></h3><p>b</p><h3>Delta</h3><p>d</p><h2>Gamma</h2>'

describe('splitDescriptionSections', () => {
  it('une section par H2, qui embarque ses H3 ; un H3 avant le premier H2 reste dans le texte d\'avant', () => {
    const { preContent, sections } = splitDescriptionSections(html)
    expect(preContent).toBe('<p>Intro</p><h3>Avant</h3><p>x</p>')
    expect(sections.map((s) => s.title)).toEqual(['Alpha', 'Gamma'])
    expect(sections[0].body).toBe('<p>a</p><h3><strong>Beta</strong></h3><p>b</p><h3>Delta</h3><p>d</p>')
    expect(sections[0].intro).toBe('<p>a</p>')
    expect(sections[0].subsections.map((s) => s.title)).toEqual(['Beta', 'Delta'])
    expect(sections[0].subsections[0].headingHtml).toBe('<h3><strong>Beta</strong></h3>')
    expect(sections[1].body).toBe('')
    expect(sections[1].subsections).toEqual([])
  })

  it('seuls les H2 comptent pour afficher « Éclater »', () => {
    expect(splitDescriptionSections('<p>x</p><h3>Titre 3</h3>').sections).toEqual([])
    expect(hasDescriptionHeadings('<p>x</p><h3>t</h3>')).toBe(false)
    expect(hasDescriptionHeadings('<hr><p>x</p>')).toBe(false)
    expect(hasDescriptionHeadings(html)).toBe(true)
  })
})

describe('planDescriptionSplit', () => {
  it('sans choix : tous les H2 deviennent des sous-éléments, H3 embarqués', () => {
    const plan = planDescriptionSplit(html)
    expect(plan.children).toEqual([
      { title: 'Alpha', description: '<p>a</p><h3><strong>Beta</strong></h3><p>b</p><h3>Delta</h3><p>d</p>', section: 0, children: [] },
      { title: 'Gamma', description: null, section: 1, children: [] },
    ])
    expect(plan.parentDescription).toBe('<p>Intro</p><h3>Avant</h3><p>x</p>')
  })

  it('H3 choisi : sous-élément de son H2, retiré de la description du H2 ; les autres H3 y restent', () => {
    const plan = planDescriptionSplit(html, { sections: [0, 1], subsections: [[0, 1]] })
    expect(plan.children[0]).toEqual({
      title: 'Alpha', description: '<p>a</p><h3><strong>Beta</strong></h3><p>b</p>', section: 0,
      children: [{ title: 'Delta', description: '<p>d</p>', section: 0, subsection: 1, children: [] }],
    })
  })

  it('H2 non choisi : reste entier dans la description, ses H3 choisis sont ignorés', () => {
    const plan = planDescriptionSplit(html, { sections: [1], subsections: [[0, 0]] })
    expect(plan.children.map((c) => c.title)).toEqual(['Gamma'])
    expect(plan.parentDescription).toBe('<p>Intro</p><h3>Avant</h3><p>x</p><h2>Alpha</h2><p>a</p><h3><strong>Beta</strong></h3><p>b</p><h3>Delta</h3><p>d</p>')
  })

  it('tout éclaté sans texte d\'avant : description vidée', () => {
    expect(planDescriptionSplit('<h2>A</h2><p>a</p>').parentDescription).toBeNull()
  })
})

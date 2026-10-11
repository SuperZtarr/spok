/* TNR de markdownToHtml : rendu Markdown → HTML compatible éditeur SPOK, neutralisation HTML brut et liens dangereux. */
import { describe, it, expect } from 'vitest'
import { markdownToHtml } from './markdown.js'

describe('markdownToHtml', () => {
  it('rend titres, listes, gras et liens', () => {
    const html = markdownToHtml('## Titre\n\n- un\n- **deux**\n\n[site](https://spok.space)')
    expect(html).toContain('<h2>Titre</h2>')
    expect(html).toContain('<li>un</li>')
    expect(html).toContain('<strong>deux</strong>')
    expect(html).toContain('<a href="https://spok.space">site</a>')
  })

  it('échappe le HTML brut', () => {
    const html = markdownToHtml('avant <script>alert(1)</script> après')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('neutralise un lien javascript:', () => {
    const html = markdownToHtml('[clic](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('clic')
  })

  it('texte vide → chaîne vide', () => {
    expect(markdownToHtml('   ')).toBe('')
  })
})

/* TNR de l'échappement des emails : une saisie utilisateur (nom, message) ne doit jamais produire de balise ni d'objet multi-ligne. */
import { describe, it, expect } from 'vitest'
import { escapeHtml, emailSubject } from './emailTemplate.js'

describe('escapeHtml', () => {
  it('neutralise balises, attributs et entités', () => {
    expect(escapeHtml(`<a href="https://evil.test">Cliquez</a> & 'x'`))
      .toBe('&lt;a href=&quot;https://evil.test&quot;&gt;Cliquez&lt;/a&gt; &amp; &#39;x&#39;')
  })
})

describe('emailSubject', () => {
  it('met l\'objet sur une seule ligne', () => {
    expect(emailSubject('Bonjour\r\nBcc: x@evil.test\tfin ')).toBe('Bonjour Bcc: x@evil.test fin')
  })
})

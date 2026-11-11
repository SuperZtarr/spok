/* TNR de buildFilePreview (aperçu d'un fichier joint) : PDF (page 1 + texte), docx avec et sans miniature intégrée,
 * texte brut, format non couvert et fichier corrompu (jamais d'erreur, rien). Fichiers d'essai fabriqués ici. */
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import sharp from 'sharp'
import { buildFilePreview, toExcerpt, EXCERPT_MAX, PREVIEW_WIDTH } from './filePreview.js'

/** PDF d'une page avec une ligne de texte en Helvetica (table xref calculée) */
function tinyPdf(text: string): Buffer {
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

/** docx minimal (un paragraphe), avec miniature intégrée facultative */
async function tinyDocx(text: string, withThumbnail: boolean): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`)
  if (withThumbnail) {
    const jpeg = await sharp({ create: { width: 200, height: 280, channels: 3, background: '#3366cc' } }).jpeg().toBuffer()
    zip.file('docProps/thumbnail.jpeg', jpeg)
  }
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('buildFilePreview', () => {
  it('PDF : page 1 en webp et texte de la page', async () => {
    const preview = await buildFilePreview(tinyPdf('Bonjour SPOK'), 'application/pdf', 'rapport.pdf')
    expect(preview.excerpt).toContain('Bonjour SPOK')
    expect(preview.image).not.toBeNull()
    const meta = await sharp(preview.image!).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(PREVIEW_WIDTH)
  }, 20_000)

  it('docx avec miniature intégrée : image et extrait', async () => {
    const preview = await buildFilePreview(await tinyDocx('Compte rendu du comité', true), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'cr.docx')
    expect(preview.excerpt).toBe('Compte rendu du comité')
    expect((await sharp(preview.image!).metadata()).format).toBe('webp')
  })

  it('docx sans miniature : extrait seul', async () => {
    const preview = await buildFilePreview(await tinyDocx('Texte seul', false), null, 'note.docx')
    expect(preview).toEqual({ image: null, excerpt: 'Texte seul' })
  })

  it('texte brut : premières lignes, espaces resserrés', async () => {
    const preview = await buildFilePreview(Buffer.from('Ligne 1\n\nLigne   2\n'), 'text/plain', 'notes.txt')
    expect(preview).toEqual({ image: null, excerpt: 'Ligne 1 Ligne 2' })
  })

  it('format non couvert : rien', async () => {
    expect(await buildFilePreview(Buffer.from('xx'), 'application/zip', 'archive.zip')).toEqual({ image: null, excerpt: null })
  })

  it('fichier corrompu : rien, sans erreur', async () => {
    expect(await buildFilePreview(Buffer.from('pas un pdf'), 'application/pdf', 'casse.pdf')).toEqual({ image: null, excerpt: null })
    expect(await buildFilePreview(Buffer.from('pas un zip'), null, 'casse.docx')).toEqual({ image: null, excerpt: null })
  })

  it('délai dépassé : rien', async () => {
    expect(await buildFilePreview(tinyPdf('Lent'), 'application/pdf', 'lent.pdf', 0)).toEqual({ image: null, excerpt: null })
  })
})

describe('toExcerpt', () => {
  it('coupe à EXCERPT_MAX avec points de suspension', () => {
    const cut = toExcerpt('a'.repeat(EXCERPT_MAX + 50))!
    expect(cut.length).toBe(EXCERPT_MAX)
    expect(cut.endsWith('…')).toBe(true)
  })
  it('vide → null', () => {
    expect(toExcerpt('  \n ')).toBeNull()
  })
})

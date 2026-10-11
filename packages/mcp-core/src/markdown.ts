/*
 * Conversion Markdown → HTML pour les champs riches SPOK (description d'item, contributions), qui sont
 * stockés en HTML et édités par RichTextEditor (Tiptap, getHTML). Le HTML brut du Markdown est échappé
 * et seuls les liens http(s)/mailto sont conservés : le contenu vient d'un modèle tiers, non de confiance.
 */
import { Marked } from 'marked'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SAFE_HREF = /^(https?:|mailto:)/i

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens)
      if (!href || !SAFE_HREF.test(href)) return label
      return `<a href="${escapeHtml(href)}">${label}</a>`
    },
  },
})

export function markdownToHtml(md: string): string {
  if (!md.trim()) return ''
  return (marked.parse(md, { async: false }) as string).trim()
}

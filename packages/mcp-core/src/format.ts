/*
 * Mise en forme texte des réponses d'outils MCP (lignes d'items, extraction de texte depuis HTML ou
 * Tiptap JSON). Purement présentationnel — aucune règle métier ici.
 */
export function extractText(description: any): string {
  if (!description) return ''
  if (typeof description === 'string') {
    let parsed: any
    try { parsed = JSON.parse(description) } catch { /* not JSON — treat as HTML */ }
    if (parsed) {
      description = parsed
    } else {
      return description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  if (typeof description !== 'object') return ''
  function collectText(node: any): string {
    if (node.type === 'text') return node.text ?? ''
    return (node.content ?? []).map(collectText).join(' ')
  }
  return (description.content ?? []).map(collectText).join('\n').trim()
}

export function formatItemLine(item: any, opts: { excerpt?: number; withSpace?: boolean; withParent?: boolean } = {}): string {
  const parts = [`[${item.id}] [${item.type}] ${item.title}`]
  if (opts.withSpace && item.space?.name) parts.push(`espace: ${item.space.name}`)
  if (item.status) parts.push(`statut: ${item.status}`)
  if (item.priority) parts.push(`priorité: ${item.priority}`)
  if (item.startDate) parts.push(`début: ${item.startDate.slice(0, 10)}`)
  if (item.endDate) parts.push(`fin: ${item.endDate.slice(0, 10)}`)
  if (item.dueDate) parts.push(`échéance: ${item.dueDate.slice(0, 10)}`)
  if (item.url) parts.push(`url: ${item.url}`)
  if (opts.withParent && item.parentId) parts.push(`parent: ${item.parentId}`)
  const max = opts.excerpt ?? 120
  const text = extractText(item.content ?? item.description)
  if (text) parts.push(`→ ${text.slice(0, max)}${text.length > max ? '…' : ''}`)
  return parts.join(' | ')
}

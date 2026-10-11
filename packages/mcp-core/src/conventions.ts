/*
 * Conventions d'un espace SPOK, résolues depuis les référentiels de sa communauté
 * (GET /spaces/:id/referentiels) : statuts et types visibles, tags de l'espace (GET /spaces/:id/tags). Fonctions de validation
 * utilisées par create_item/update_item (statut, type, tags, dates) : chaque refus lève ConventionError
 * avec les valeurs acceptées.
 */
import type { SpokClient } from './client.js'
import { ConventionError } from './errors.js'

export interface SpaceConventions {
  statuses: { id: string; label: string }[]
  types: { id: string; label: string }[]
  tags: { id: string; name: string }[]
}

export async function fetchConventions(client: SpokClient, spaceId: string): Promise<SpaceConventions> {
  // Les tags sont propres à l'espace (routes/tags.ts monté sur /spaces/:spaceId/tags) — pas de route /tags racine.
  const [refRes, tagsRes] = await Promise.all([
    client.get(`/spaces/${spaceId}/referentiels`),
    client.get(`/spaces/${spaceId}/tags`),
  ])
  const ref = refRes.referentiels ?? refRes
  const statuses = [...(ref.statuses ?? [])]
    .filter((s: any) => s.visible !== false)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => ({ id: s.id, label: s.label }))
  const types = Object.entries(ref.typeLabels ?? {})
    .filter(([, t]: [string, any]) => t.visible !== false)
    .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([id, t]: [string, any]) => ({ id, label: t.label }))
  const tagList = Array.isArray(tagsRes) ? tagsRes : (tagsRes.data ?? [])
  return { statuses, types, tags: tagList.map((t: any) => ({ id: t.id, name: t.name })) }
}

function list(values: { id: string; label: string }[]): string {
  return values.map((v) => `${v.id} (${v.label})`).join(', ')
}

export function resolveStatus(input: string, conv: SpaceConventions): string {
  const raw = input.trim()
  const byId = conv.statuses.find((s) => s.id === raw)
  if (byId) return byId.id
  const norm = raw.toLowerCase()
  const byLabel = conv.statuses.find((s) => s.label.trim().toLowerCase() === norm)
  if (byLabel) return byLabel.id
  throw new ConventionError(`Statut « ${input} » inconnu dans cet espace. Valeurs acceptées : ${list(conv.statuses)}.`)
}

/** Tags donnés par id ou par nom (casse et espaces ignorés) → ids, dédoublonnés. Inconnu → ConventionError. */
export function resolveTags(inputs: string[], conv: SpaceConventions): string[] {
  const ids: string[] = []
  for (const input of inputs) {
    const raw = input.trim()
    const tag = conv.tags.find((t) => t.id === raw) ?? conv.tags.find((t) => t.name.trim().toLowerCase() === raw.toLowerCase())
    if (!tag) {
      const known = conv.tags.length ? conv.tags.map((t) => `${t.name} [${t.id}]`).join(', ') : 'aucun'
      throw new ConventionError(`Tag « ${input} » inexistant dans cet espace. Tags existants : ${known}. Ne pas inventer de tag.`)
    }
    if (!ids.includes(tag.id)) ids.push(tag.id)
  }
  return ids
}

export function assertTypeAllowed(type: string, conv: SpaceConventions): void {
  if (!conv.types.some((t) => t.id === type)) {
    throw new ConventionError(`Type « ${type} » non utilisé dans cet espace. Types acceptés : ${list(conv.types)}.`)
  }
}

export function assertDateOrder(start?: string, end?: string): void {
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw new ConventionError(`endDate (${end.slice(0, 10)}) est antérieure à startDate (${start.slice(0, 10)}).`)
  }
}

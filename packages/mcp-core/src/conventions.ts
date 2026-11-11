/*
 * Conventions d'un espace SPOK, résolues depuis les référentiels de sa communauté
 * (GET /spaces/:id/referentiels) : statuts et types visibles, tags de l'espace (GET /spaces/:id/tags). Fonctions de validation
 * utilisées par create_item/update_item (statut, type, tags, dates) : chaque refus lève ConventionError
 * avec les valeurs acceptées.
 * Statuts réservés (2026-11-08) : un statut porteur de `types` n'est permis que pour ces types, et un type qui a des
 * statuts réservés (QUESTION) n'utilise qu'eux — même règle que statusesForType (@spok/shared), recopiée ici
 * (mcp-core ne dépend pas de @spok/shared). Sans type connu (update_item sans type), l'API normalise.
 */
import type { SpokClient } from './client.js'
import { ConventionError } from './errors.js'

export interface SpaceConventions {
  statuses: { id: string; label: string; types?: string[] }[]
  types: { id: string; label: string }[]
  tags: { id: string; name: string }[]
}

export async function fetchConventions(client: SpokClient, spaceId: string): Promise<SpaceConventions> {
  // Tags utilisables dans l'espace : ceux de sa communauté + globaux (routes/tags.ts monté sur /spaces/:spaceId/tags).
  const [refRes, tagsRes] = await Promise.all([
    client.get(`/spaces/${spaceId}/referentiels`),
    client.get(`/spaces/${spaceId}/tags`),
  ])
  const ref = refRes.referentiels ?? refRes
  const statuses = [...(ref.statuses ?? [])]
    .filter((s: any) => s.visible !== false)
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => ({ id: s.id, label: s.label, ...(s.types?.length ? { types: s.types as string[] } : {}) }))
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

/** Statuts utilisables pour un type : ses statuts réservés s'il en a, sinon les statuts sans réservation. */
export function statusesForType(conv: SpaceConventions, type?: string): SpaceConventions['statuses'] {
  const reserved = type ? conv.statuses.filter((s) => s.types?.includes(type)) : []
  return reserved.length ? reserved : conv.statuses.filter((s) => !s.types?.length)
}

export function resolveStatus(input: string, conv: SpaceConventions, type?: string): string {
  const raw = input.trim()
  const norm = raw.toLowerCase()
  const found = conv.statuses.find((s) => s.id === raw) ?? conv.statuses.find((s) => s.label.trim().toLowerCase() === norm)
  if (!found) throw new ConventionError(`Statut « ${input} » inconnu dans cet espace. Valeurs acceptées : ${list(conv.statuses)}.`)
  if (type) {
    const allowed = statusesForType(conv, type)
    if (!allowed.some((s) => s.id === found.id)) {
      throw new ConventionError(`Statut « ${input} » non permis pour le type ${type}. Valeurs acceptées pour ce type : ${list(allowed)}.`)
    }
  }
  return found.id
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

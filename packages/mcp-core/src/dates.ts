/*
 * Normalisation des dates fournies par un modèle vers l'ISO 8601 complet exigé par l'API
 * (z.string().datetime()). Accepte AAAA-MM-JJ (minuit UTC) ou un ISO avec heure/fuseau.
 */
import { ConventionError } from './errors.js'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_WITH_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function normalizeDate(value: string, field: string): string {
  const v = value.trim()
  if (DATE_ONLY.test(v)) {
    const d = new Date(`${v}T00:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (ISO_WITH_TIME.test(v)) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  throw new ConventionError(`${field} : date invalide « ${value} ». Format attendu : AAAA-MM-JJ ou ISO 8601 (ex. 2026-10-15T09:00:00Z).`)
}

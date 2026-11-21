/*
 * Garde de non-fuite des données sécurisées (2026-11-20) : la table item_secrets n'est lue que par
 * routes/item-secrets.ts, utils/itemSecrets.ts et utils/secretCrypto.ts. Toute autre route (liste et détail des
 * éléments, recherche, export, activité, articles, séances, notifications, vignettes…) ne peut donc pas renvoyer une
 * valeur qu'elle ne lit pas. Le MCP (packages/mcp-core) ne doit jamais appeler la révélation.
 * Un nouvel accès à la table = l'ajouter ici en connaissance de cause, après revue.
 * Sauvegarde / restauration dans l'audit (2026-11-21) : passent par utils/itemSecrets.ts (snapshot, restore, redact).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const API_SRC = join(here, '..')
const MCP_SRC = join(here, '../../../../packages/mcp-core/src')
const ALLOWED = new Set(['routes/item-secrets.ts', 'utils/itemSecrets.ts', 'utils/secretCrypto.ts'])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.ts$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('non-fuite des données sécurisées', () => {
  it('seuls les modules autorisés touchent la table item_secrets', () => {
    const offenders = sources(API_SRC)
      .map((p) => relative(API_SRC, p).replace(/\\/g, '/'))
      .filter((rel) => !ALLOWED.has(rel) && !rel.startsWith('test/'))
      .filter((rel) => /itemSecret\b|itemSecret\.|valueEnc|loginEnc|item_secrets/.test(readFileSync(join(API_SRC, rel), 'utf8')))
    expect(offenders).toEqual([])
  })

  it('le MCP n\'appelle jamais la révélation', () => {
    const offenders = sources(MCP_SRC).filter((p) => /\/reveal/.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
})

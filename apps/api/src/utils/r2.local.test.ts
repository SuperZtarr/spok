/*
 * Tests du stockage LOCAL de dev (utils/r2.ts + routes/local-uploads.ts) : actif sans R2 hors production,
 * jamais en production ; écriture/lecture/suppression/copie sur disque ; route protégée contre la sortie du dossier.
 * Écrit réellement dans apps/api/.local-uploads/items/test-local-* (nettoyé en fin de test).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  isLocalStorageMode, isR2Configured, uploadImageToR2, deleteImageFromR2, copyR2Object, isR2Url,
  localPathForKey, LOCAL_UPLOADS_DIR, LOCAL_UPLOADS_URL,
} from './r2.js'
import { localUploadsRoutes } from '../routes/local-uploads.js'

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of [...R2_KEYS, 'NODE_ENV']) saved[k] = process.env[k]
  for (const k of R2_KEYS) delete process.env[k]
  process.env.NODE_ENV = 'development'
})
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
})
afterAll(async () => {
  await rm(path.join(LOCAL_UPLOADS_DIR, 'items', 'test-local-1'), { recursive: true, force: true })
  await rm(path.join(LOCAL_UPLOADS_DIR, 'items', 'test-local-2'), { recursive: true, force: true })
})

describe('stockage local de dev', () => {
  it('actif sans R2 hors production, jamais en production', () => {
    expect(isLocalStorageMode()).toBe(true)
    expect(isR2Configured()).toBe(true)
    process.env.NODE_ENV = 'production'
    expect(isLocalStorageMode()).toBe(false)
    expect(isR2Configured()).toBe(false) // la prod sans R2 refuse les uploads, comme avant
  })

  it('inactif dès que R2 est configuré', () => {
    for (const k of R2_KEYS) process.env[k] = 'x'
    expect(isLocalStorageMode()).toBe(false)
  })

  it('envoi : fichier écrit sur disque, URL /api/local-uploads/…, copie puis suppression', async () => {
    const url = await uploadImageToR2(Buffer.from('img'), 'test-local-1')
    expect(url.startsWith(`${LOCAL_UPLOADS_URL}/items/test-local-1/`)).toBe(true)
    expect(isR2Url(url)).toBe(true)
    const key = url.slice(LOCAL_UPLOADS_URL.length + 1)
    expect((await readFile(localPathForKey(key)!)).toString()).toBe('img')

    const copy = await copyR2Object(url, 'test-local-2')
    expect(copy.startsWith(`${LOCAL_UPLOADS_URL}/items/test-local-2/`)).toBe(true)
    expect((await readFile(localPathForKey(copy.slice(LOCAL_UPLOADS_URL.length + 1))!)).toString()).toBe('img')

    await deleteImageFromR2(url)
    await expect(readFile(localPathForKey(key)!)).rejects.toThrow()
  })

  it('localPathForKey refuse de sortir du dossier', () => {
    expect(localPathForKey('../secret.txt')).toBeNull()
    expect(localPathForKey('items/../../package.json')).toBeNull()
    expect(localPathForKey('items/a/b.webp')).not.toBeNull()
  })

  it('route GET /local-uploads/* : sert le fichier, refuse un chemin piégé', async () => {
    const url = await uploadImageToR2(Buffer.from('servi'), 'test-local-1')
    const app = Fastify({ logger: false })
    await app.register(sensible)
    await app.register(localUploadsRoutes, { prefix: '/local-uploads' })
    await app.ready()

    const ok = await app.inject({ method: 'GET', url: url.replace('/api', '') })
    expect(ok.statusCode).toBe(200)
    expect(ok.headers['content-type']).toContain('image/webp')
    expect(ok.body).toBe('servi')

    const evil = await app.inject({ method: 'GET', url: '/local-uploads/..%2F..%2Fpackage.json' })
    expect([400, 404]).toContain(evil.statusCode)
    expect(evil.body).not.toContain('"name"')
    await app.close()
  })
})

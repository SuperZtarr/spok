/*
 * TNR de GET /url-meta (protection SSRF) : filtre d'adresses privées/locales/réservées, refus d'un nom qui
 * résout vers une adresse interne (même mêlée à une publique), refus d'une redirection vers l'interne, arrêt
 * après MAX_REDIRECTS sauts, page publique acceptée (DNS et HTTP simulés), rate-limit propre à la route.
 */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'
import {
  urlMetaRoutes, isBlockedAddress, MAX_REDIRECTS, URL_META_PER_MINUTE,
  type Resolver, type Transport, type RawResponse, type ResolvedAddress,
} from './url-meta.js'

const PUBLIC = '93.184.215.14'

function page(status: number, opts: { location?: string; html?: string } = {}): RawResponse {
  const html = opts.html ?? ''
  return {
    status,
    location: opts.location ?? null,
    contentType: 'text/html; charset=utf-8',
    body: (async function* () { yield new TextEncoder().encode(html) })(),
    close: () => {},
  }
}

async function buildApp(dnsTable: Record<string, string[]>, handler: (url: URL) => RawResponse) {
  const calls: { url: string; addresses: ResolvedAddress[] }[] = []
  const resolve: Resolver = async (host) => {
    const ips = dnsTable[host]
    if (!ips) throw new Error('ENOTFOUND')
    return ips.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
  const transport: Transport = async (url, addresses) => {
    calls.push({ url: url.href, addresses })
    return handler(url)
  }
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(rateLimit, { global: false })
  await app.register(urlMetaRoutes, { resolve, transport })
  await app.ready()
  return { app, calls }
}

const get = (app: Awaited<ReturnType<typeof buildApp>>['app'], url: string) =>
  app.inject({ method: 'GET', url: `/url-meta?url=${encodeURIComponent(url)}` })

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '127.8.9.10', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fd12:3456::1', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '64:ff9b::a00:1', 'not-an-ip',
  ])('bloque %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each([PUBLIC, '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111'])('laisse passer %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })
})

describe('GET /url-meta', () => {
  it.each([
    'http://localhost/', 'http://127.0.0.1:3001/admin', 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'http://interne.example/', 'http://mixte.example/', 'http://api.railway.internal/',
  ])('refuse %s sans rien interroger', async (url) => {
    const { app, calls } = await buildApp({
      localhost: ['127.0.0.1', '::1'],
      'interne.example': ['10.0.0.5'],
      'mixte.example': [PUBLIC, '192.168.0.10'],
      'api.railway.internal': ['fd12:abcd::2'],
    }, () => page(200))
    const res = await get(app, url)
    expect(res.statusCode).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('refuse une redirection vers une adresse interne', async () => {
    const { app, calls } = await buildApp({ 'public.example': [PUBLIC] },
      () => page(302, { location: 'http://127.0.0.1/secret' }))
    const res = await get(app, 'https://public.example/')
    expect(res.statusCode).toBe(400)
    expect(calls.map((c) => c.url)).toEqual(['https://public.example/'])
  })

  it('refuse une redirection vers un schéma non http(s)', async () => {
    const { app } = await buildApp({ 'public.example': [PUBLIC] },
      () => page(301, { location: 'file:///etc/passwd' }))
    const res = await get(app, 'https://public.example/')
    expect(res.statusCode).toBe(400)
  })

  it(`s'arrête après ${MAX_REDIRECTS} redirections`, async () => {
    let n = 0
    const { app, calls } = await buildApp({ 'public.example': [PUBLIC] },
      () => page(302, { location: `/r${++n}` }))
    const res = await get(app, 'https://public.example/')
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBeNull()
    expect(calls).toHaveLength(MAX_REDIRECTS + 1)
  })

  it('suit une redirection publique et extrait les métadonnées', async () => {
    const html = '<html><head><title>Exemple &amp; Co</title><meta name="description" content="Desc">'
      + '<link rel="icon" href="/ico.png"></head><body>…</body></html>'
    const { app, calls } = await buildApp({ 'public.example': [PUBLIC], 'www.public.example': [PUBLIC] },
      (url) => url.hostname === 'public.example' ? page(301, { location: 'https://www.public.example/' }) : page(200, { html }))
    const res = await get(app, 'https://public.example/')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ title: 'Exemple & Co', description: 'Desc', favicon: 'https://www.public.example/ico.png' })
    // La connexion part vers l'adresse vérifiée
    expect(calls[1].addresses).toEqual([{ address: PUBLIC, family: 4 }])
  })

  it('renvoie des métadonnées vides si le nom ne se résout pas', async () => {
    const { app, calls } = await buildApp({}, () => page(200))
    const res = await get(app, 'https://inconnu.example/')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ title: null, description: null, favicon: 'https://inconnu.example/favicon.ico' })
    expect(calls).toHaveLength(0)
  })

  it(`limite à ${URL_META_PER_MINUTE} requêtes par minute et par IP`, async () => {
    const { app } = await buildApp({ 'public.example': [PUBLIC] }, () => page(200, { html: '<title>t</title>' }))
    for (let i = 0; i < URL_META_PER_MINUTE; i++) {
      expect((await get(app, 'https://public.example/')).statusCode).toBe(200)
    }
    expect((await get(app, 'https://public.example/')).statusCode).toBe(429)
  })
})

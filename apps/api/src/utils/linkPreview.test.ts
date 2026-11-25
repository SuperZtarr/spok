/* TNR de l'aperçu des liens (utils/linkPreview.ts, 2026-11-25) : adresses refusées (privées, locales, IPv6, IPv4
 * mappée), nom résolvant vers une adresse interne, redirection vers l'interne, ports et protocoles, plafonds, type non
 * image et SVG refusés, ordre og → twitter → icône, adresse relative. Réseau entièrement simulé (deps injectées). */
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { isBlockedAddress, findPreviewImageUrl, fetchLinkPreview, type LinkPreviewDeps, type RawResponse } from './linkPreview.js'

const png = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).png().toBuffer()
const html = (head: string): RawResponse => ({ status: 200, contentType: 'text/html', body: Buffer.from(`<html><head>${head}</head><body></body></html>`) })

function deps(routes: Record<string, RawResponse | (() => Promise<RawResponse>)>, dns: Record<string, string[]> = {}): LinkPreviewDeps & { fetchRaw: any } {
  return {
    resolve: async (host) => dns[host] ?? ['93.184.216.34'],
    fetchRaw: vi.fn(async (url: URL) => {
      const r = routes[url.href]
      if (!r) throw new Error('inattendu ' + url.href)
      return typeof r === 'function' ? r() : r
    }),
  }
}

describe('isBlockedAddress', () => {
  it('refuse les adresses privées, locales et spéciales', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
      '224.0.0.1', '255.255.255.255', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', 'pas-une-ip']) {
      expect(isBlockedAddress(ip), ip).toBe(true)
    }
  })
  it('accepte une adresse publique', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) expect(isBlockedAddress(ip), ip).toBe(false)
  })
})

describe('findPreviewImageUrl', () => {
  it('ordre og → twitter → apple-touch-icon → icon, adresse relative résolue', () => {
    const base = 'https://site.test/a/page'
    expect(findPreviewImageUrl('<meta name="twitter:image" content="/t.png"><meta property="og:image" content="https://cdn.test/o.png">', base)).toBe('https://cdn.test/o.png')
    expect(findPreviewImageUrl('<meta name="twitter:image" content="t.png"><link rel="icon" href="/i.png">', base)).toBe('https://site.test/a/t.png')
    expect(findPreviewImageUrl('<link rel="shortcut icon" href="/i.png"><link rel="apple-touch-icon" href="/a.png">', base)).toBe('https://site.test/a.png')
    expect(findPreviewImageUrl('<meta property="og:image" content="javascript:alert(1)">', base)).toBeNull()
    expect(findPreviewImageUrl('<title>x</title>', base)).toBeNull()
  })
})

describe('fetchLinkPreview', () => {
  it('page → og:image → octets de l\'image', async () => {
    const img = await png()
    const d = deps({
      'https://site.test/': html('<meta property="og:image" content="https://cdn.test/o.png">'),
      'https://cdn.test/o.png': { status: 200, contentType: 'image/png', body: img },
    })
    expect((await fetchLinkPreview('https://site.test/', d))?.equals(img)).toBe(true)
  })

  it('nom résolvant vers une adresse interne : aucun appel', async () => {
    const d = deps({}, { 'intranet.test': ['10.0.0.5'] })
    expect(await fetchLinkPreview('https://intranet.test/', d)).toBeNull()
    expect(d.fetchRaw).not.toHaveBeenCalled()
  })

  it('une seule adresse interne parmi plusieurs suffit à refuser', async () => {
    const d = deps({}, { 'mixte.test': ['93.184.216.34', '127.0.0.1'] })
    expect(await fetchLinkPreview('https://mixte.test/', d)).toBeNull()
    expect(d.fetchRaw).not.toHaveBeenCalled()
  })

  it('redirection vers une adresse interne : refusée avant tout appel', async () => {
    const d = deps({ 'https://site.test/': { status: 302, location: 'http://169.254.169.254/latest/meta-data', contentType: '', body: Buffer.alloc(0) } })
    expect(await fetchLinkPreview('https://site.test/', d)).toBeNull()
    expect(d.fetchRaw).toHaveBeenCalledTimes(1)
  })

  it('image pointant vers l\'interne, port non standard, protocole non web : refusés', async () => {
    const d = deps({ 'https://site.test/': html('<meta property="og:image" content="http://localhost/x.png">') }, { localhost: ['127.0.0.1'] })
    expect(await fetchLinkPreview('https://site.test/', d)).toBeNull()
    expect(await fetchLinkPreview('https://site.test:8080/', deps({}))).toBeNull()
    expect(await fetchLinkPreview('ftp://site.test/', deps({}))).toBeNull()
    expect(await fetchLinkPreview('https://user:pw@site.test/', deps({}))).toBeNull()
  })

  it('plus de 3 redirections : abandon', async () => {
    const hop = (n: number): RawResponse => ({ status: 301, location: `https://site.test/${n}`, contentType: '', body: Buffer.alloc(0) })
    const d = deps({ 'https://site.test/0': hop(1), 'https://site.test/1': hop(2), 'https://site.test/2': hop(3), 'https://site.test/3': hop(4) })
    expect(await fetchLinkPreview('https://site.test/0', d)).toBeNull()
  })

  it('SVG, type non image ou faux fichier image : refusés', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://169.254.169.254/"/></svg>')
    for (const [type, body] of [['image/svg+xml', svg], ['image/png', svg], ['text/plain', await png()]] as const) {
      const d = deps({
        'https://site.test/': html('<meta property="og:image" content="https://cdn.test/o">'),
        'https://cdn.test/o': { status: 200, contentType: type, body },
      })
      expect(await fetchLinkPreview('https://site.test/', d), type).toBeNull()
    }
  })

  it('image trop grosse (refus du transport) : null sans erreur', async () => {
    const d = deps({
      'https://site.test/': html('<meta property="og:image" content="https://cdn.test/o.png">'),
      'https://cdn.test/o.png': () => Promise.reject(new Error('trop gros')),
    })
    expect(await fetchLinkPreview('https://site.test/', d)).toBeNull()
  })
})

describe('transport réel (serveur local, adresse épinglée)', () => {
  it('se connecte à l\'adresse validée quel que soit le nom ; coupe la page, refuse l\'image trop grosse', async () => {
    const { createServer } = await import('node:http')
    const { _defaultFetchRaw } = await import('./linkPreview.js')
    const big = Buffer.alloc(3000, 'a')
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(req.headers.host?.startsWith('nom-inexistant.test') ? big : 'mauvais hôte')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const port = (server.address() as any).port
    try {
      const url = new URL(`http://nom-inexistant.test:${port}/`)
      const page = await _defaultFetchRaw(url, '127.0.0.1', { maxBytes: 1000, truncate: true })
      expect(page.status).toBe(200)
      expect(page.body.length).toBe(1000)
      await expect(_defaultFetchRaw(url, '127.0.0.1', { maxBytes: 1000, truncate: false })).rejects.toThrow()
    } finally {
      server.close()
    }
  })
})

/*
 * Métadonnées d'une URL (title/description/favicon) pour l'aperçu des items LINK — fetch côté serveur.
 * Accessible sans connexion (vue Liens, blocs Lien d'un article public) : c'est donc un relais de requêtes
 * serveur, protégé contre la SSRF (faille corrigée 2026-10-24, businessRules url-meta-public-only) :
 * - seules les adresses publiques sont interrogées : le nom est résolu (toutes ses adresses) et refusé si UNE
 *   seule est privée/locale/réservée (isBlockedAddress) ; la connexion part vers l'adresse vérifiée (lookup
 *   épinglé), pas de seconde résolution exploitable entre contrôle et connexion ;
 * - redirections suivies à la main (MAX_REDIRECTS sauts), chaque saut revalidé ;
 * - lecture plafonnée à MAX_BYTES, arrêt dès </head> ; délai global FETCH_TIMEOUT_MS ;
 * - rate-limit propre à la route (URL_META_PER_MINUTE par IP), plus bas que le global.
 * URL refusée → 400 ; erreur réseau / page non HTML → méta vides (favicon par défaut de l'origine).
 * Options du plugin `resolve` / `transport` : injection pour les tests uniquement, jamais en production.
 */
import { FastifyPluginAsync } from 'fastify';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export const URL_META_PER_MINUTE = 60;
export const MAX_REDIRECTS = 3;
export const MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5000;

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

/** Réponse brute d'un saut HTTP, sans suivre les redirections. */
export interface RawResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: AsyncIterable<Uint8Array>;
  close(): void;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type Transport = (url: URL, addresses: ResolvedAddress[], signal: AbortSignal) => Promise<RawResponse>;

export class BlockedUrlError extends Error {}

// Plages privées, locales, réservées ou de traduction (qui pourraient ramener vers l'interne)
const blockList = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockList.addSubnet(net4, prefix, 'ipv4');
for (const [net6, prefix] of [
  // ::ffff:a.b.c.d (IPv4 mappée) : BlockList la confronte déjà aux règles IPv4 ci-dessus
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) blockList.addSubnet(net6, prefix, 'ipv6');

/** true si l'adresse IP ne doit jamais être interrogée (ou n'est pas une IP). */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true;
  return blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const defaultResolve: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

/** Résout le nom de l'URL et refuse si une seule adresse est bloquée. Renvoie les adresses vérifiées. */
export async function checkHost(hostname: string, resolve: Resolver = defaultResolve): Promise<ResolvedAddress[]> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedUrlError(host);
    return [{ address: host, family: net.isIP(host) }];
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new Error(`DNS lookup failed: ${host}`);
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) throw new BlockedUrlError(host);
  return addresses;
}

/** Transport réel : http(s).request dont la résolution est épinglée sur les adresses déjà vérifiées. */
const defaultTransport: Transport = (url, addresses, signal) => new Promise((resolve, reject) => {
  const lookup = (_host: string, opts: { all?: boolean }, cb: (...args: any[]) => void) => {
    if (opts?.all) cb(null, addresses);
    else cb(null, addresses[0].address, addresses[0].family);
  };
  const req = (url.protocol === 'https:' ? https : http).request(url, {
    method: 'GET',
    headers: { 'User-Agent': 'SPOK-LinkPreview/1.0', 'Accept': 'text/html' },
    lookup: lookup as any,
    signal,
  }, (res) => {
    resolve({
      status: res.statusCode ?? 0,
      location: typeof res.headers.location === 'string' ? res.headers.location : null,
      contentType: res.headers['content-type'] || '',
      body: res,
      close: () => res.destroy(),
    });
  });
  req.on('error', reject);
  req.end();
});

/** Suit les redirections à la main en revalidant chaque saut ; renvoie la réponse finale et son URL. */
export async function fetchPublic(
  start: URL, signal: AbortSignal, resolve?: Resolver, transport: Transport = defaultTransport,
): Promise<{ response: RawResponse; url: URL }> {
  let current = start;
  for (let hop = 0; ; hop++) {
    if (!['http:', 'https:'].includes(current.protocol)) throw new BlockedUrlError(current.protocol);
    const addresses = await checkHost(current.hostname, resolve);
    const response = await transport(current, addresses, signal);
    if (response.status >= 300 && response.status < 400 && response.location) {
      response.close();
      if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects');
      current = new URL(response.location, current);
      continue;
    }
    return { response, url: current };
  }
}

/** Lit au plus MAX_BYTES, s'arrête dès la fin de <head>. */
async function readHead(body: AsyncIterable<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  for await (const chunk of body) {
    const slice = bytes + chunk.length > MAX_BYTES ? chunk.subarray(0, MAX_BYTES - bytes) : chunk;
    bytes += slice.length;
    html += decoder.decode(slice, { stream: true });
    if (bytes >= MAX_BYTES || /<\/head>/i.test(html)) break;
  }
  return html;
}

function extractMeta(html: string, baseUrl: string): UrlMeta {
  let title: string | null = null;
  let description: string | null = null;
  let favicon: string | null = null;

  // og:title or twitter:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitle) title = ogTitle[1];

  // Fallback: <title>
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) title = titleTag[1].trim();
  }

  // og:description or meta description
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogDesc) description = ogDesc[1];

  if (!description) {
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDesc) description = metaDesc[1];
  }

  // Favicon: link rel="icon" or rel="shortcut icon"
  const iconLink = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (iconLink) {
    const href = iconLink[1];
    try {
      favicon = new URL(href, baseUrl).href;
    } catch {
      favicon = href;
    }
  }

  // Fallback favicon: /favicon.ico
  if (!favicon) {
    try {
      const u = new URL(baseUrl);
      favicon = `${u.origin}/favicon.ico`;
    } catch { /* ignore */ }
  }

  // Decode HTML entities
  if (title) title = decodeEntities(title);
  if (description) description = decodeEntities(description);

  return { title, description, favicon };
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export const urlMetaRoutes: FastifyPluginAsync<{ resolve?: Resolver; transport?: Transport }> = async (fastify, opts) => {
  fastify.get('/url-meta', {
    config: { rateLimit: { max: URL_META_PER_MINUTE, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { url } = request.query as { url?: string };

    if (!url || typeof url !== 'string') {
      return reply.badRequest('Missing url parameter');
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return reply.badRequest('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return reply.badRequest('Only HTTP(S) URLs are supported');
    }

    const empty = { title: null, description: null, favicon: `${parsed.origin}/favicon.ico` };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { response, url: finalUrl } = await fetchPublic(parsed, controller.signal, opts.resolve, opts.transport);
      try {
        if (response.status < 200 || response.status >= 300 || !response.contentType.includes('text/html')) {
          return empty;
        }
        const html = await readHead(response.body);
        // Cache for 24h
        reply.header('Cache-Control', 'public, max-age=86400');
        return extractMeta(html, finalUrl.href);
      } finally {
        response.close();
      }
    } catch (err) {
      if (err instanceof BlockedUrlError) return reply.badRequest('URL not allowed');
      // Timeout, DNS or network error, too many redirects — return empty
      return empty;
    } finally {
      clearTimeout(timeout);
    }
  });
};

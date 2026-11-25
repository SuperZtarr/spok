/*
 * Aperçu d'un lien (2026-11-25, signalement cmwte098z01no7icc0ntwet9s) : l'API va chercher UNE fois l'image d'aperçu du
 * site (og:image, twitter:image, apple-touch-icon, icon), la ramène en webp et la range dans R2 sous items/<id>/ ;
 * elle devient le previewUrl du contenu lien. Le site n'est jamais rappelé à l'affichage.
 * Protection SSRF (requête lancée par le serveur vers une adresse saisie par un utilisateur) :
 * - http/https, ports 80 et 443 seulement, pas d'identifiants dans l'adresse ;
 * - toutes les adresses du nom résolues ; refus si l'une est privée, locale ou spéciale (isBlockedAddress, IPv4 mappée
 *   comprise) ; la connexion se fait sur l'adresse VALIDÉE (lookup épinglé) — pas de contournement par re-résolution ;
 * - redirections suivies à la main (3 au plus), chacune revalidée ; 5 s par requête ;
 * - page lue jusqu'à 1 Mo (coupée), image refusée au-delà de 5 Mo ; png / jpeg / gif / webp / avif seulement, format
 *   vérifié sur les octets (sharp.metadata) — jamais de SVG.
 * Toute erreur → null (pas d'aperçu, aucune erreur pour l'utilisateur). Dépendances injectables pour les tests (aucun
 * appel réseau réel dans les tests). Usage : routes/item-contents.ts seulement.
 */
import { BlockList, isIP } from 'node:net';
import { promises as dnsPromises } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import sharp from 'sharp';
import { isR2Configured, processImage, uploadImageToR2, deleteFileFromR2 } from './r2.js';

const PAGE_MAX = 1024 * 1024;
const IMAGE_MAX = 5 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'SPOK-LinkPreview/1.0';
const IMAGE_FORMATS = new Set(['png', 'jpeg', 'gif', 'webp', 'heif']);

const BLOCKED = new BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) BLOCKED.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 96], ['fc00::', 7], ['2002::', 16], ['64:ff9b:1::', 48], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
  ['64:ff9b::', 96], ['2001:db8::', 32], ['100::', 64]] as const) BLOCKED.addSubnet(a, p, 'ipv6');

/** Adresse IP à ne jamais contacter (privée, locale, réservée) ; une valeur qui n'est pas une IP est refusée */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return BLOCKED.check(ip, 'ipv4');
  if (family !== 6) return true;
  const low = ip.toLowerCase();
  // IPv4 mappée (::ffff:a.b.c.d ou ::ffff:xxxx:yyyy) : vérifiée comme l'IPv4 qu'elle désigne
  const dotted = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isBlockedAddress(dotted[1]);
  const hex = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16); const lo = parseInt(hex[2], 16);
    return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return BLOCKED.check(ip, 'ipv6');
}

export interface RawResponse { status: number; location?: string; contentType: string; body: Buffer }

export interface LinkPreviewDeps {
  /** Toutes les adresses d'un nom d'hôte */
  resolve: (host: string) => Promise<string[]>;
  /** Requête GET vers `url` en se connectant à `address` (déjà validée) */
  fetchRaw: (url: URL, address: string, opts: { maxBytes: number; truncate: boolean }) => Promise<RawResponse>;
}

const defaultResolve = async (host: string) => (await dnsPromises.lookup(host, { all: true, verbatim: true })).map((a) => a.address);

function defaultFetchRaw(url: URL, address: string, opts: { maxBytes: number; truncate: boolean }): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const family = isIP(address);
    // Connexion épinglée sur l'adresse validée, quel que soit le nom (SNI et Host restent ceux de l'adresse saisie)
    const lookup = (_h: string, o: any, cb: any) => (o?.all ? cb(null, [{ address, family }]) : cb(null, address, family));
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET', lookup: lookup as any, timeout: TIMEOUT_MS, agent: false,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,image/*;q=0.9,*/*;q=0.1' },
    }, (res) => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location: res.headers.location, contentType, body: Buffer.alloc(0) });
      }
      const declared = Number(res.headers['content-length'] ?? 0);
      if (!opts.truncate && declared > opts.maxBytes) { res.destroy(); return reject(new Error('trop gros')); }
      const chunks: Buffer[] = []; let size = 0; let done = false;
      const finish = () => { if (!done) { done = true; resolve({ status, contentType, body: Buffer.concat(chunks) }); } };
      res.on('data', (chunk: Buffer) => {
        if (done) return;
        size += chunk.length;
        if (size > opts.maxBytes) {
          if (!opts.truncate) { done = true; res.destroy(); return reject(new Error('trop gros')); }
          chunks.push(chunk.subarray(0, chunk.length - (size - opts.maxBytes)));
          res.destroy(); return finish();
        }
        chunks.push(chunk);
      });
      res.on('end', finish);
      res.on('error', (e) => { if (!done) { done = true; reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('délai dépassé')));
    req.on('error', reject);
    req.end();
  });
}

const DEFAULT_DEPS: LinkPreviewDeps = { resolve: defaultResolve, fetchRaw: defaultFetchRaw };
/** Transport réel, exposé pour ses tests seulement (connexion épinglée, plafonds) */
export const _defaultFetchRaw = defaultFetchRaw;

/** Adresse acceptable sur la forme (protocole, port, pas d'identifiants) */
function shapeOk(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return url.port === '' || url.port === '80' || url.port === '443';
}

/** GET avec redirections revalidées ; null si une étape est refusée */
async function safeGet(start: string, opts: { maxBytes: number; truncate: boolean }, deps: LinkPreviewDeps): Promise<RawResponse | null> {
  let url: URL;
  try { url = new URL(start); } catch { return null; }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!shapeOk(url)) return null;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : await deps.resolve(host).catch(() => [] as string[]);
    if (addresses.length === 0 || addresses.some(isBlockedAddress)) return null;
    const res = await deps.fetchRaw(url, addresses[0], opts);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) return null;
      try { url = new URL(res.location, url); } catch { return null; }
      continue;
    }
    return res;
  }
  return null;
}

const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

/** Adresse de l'image d'aperçu déclarée par la page (og → twitter → apple-touch-icon → icon), absolue ; null sinon */
export function findPreviewImageUrl(html: string, baseUrl: string): string | null {
  const end = html.search(/<\/head>/i);
  const head = end >= 0 ? html.slice(0, end) : html;
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (key: string) => metas.find((a) => (a.property ?? a.name ?? '').toLowerCase() === key)?.content;
  const link = (test: (rel: string) => boolean) => links.find((a) => test((a.rel ?? '').toLowerCase()))?.href;
  const candidates = [
    meta('og:image'), meta('og:image:secure_url'), meta('og:image:url'), meta('twitter:image'), meta('twitter:image:src'),
    link((r) => r.includes('apple-touch-icon')), link((r) => r.split(/\s+/).includes('icon')),
  ];
  for (const c of candidates) {
    if (!c?.trim()) continue;
    try {
      const u = new URL(c.trim(), baseUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch { /* adresse illisible : candidate suivante */ }
  }
  return null;
}

/** Octets de l'image d'aperçu d'une page (ou de l'adresse elle-même si c'est une image) ; null si rien d'utilisable */
export async function fetchLinkPreview(pageUrl: string, deps: LinkPreviewDeps = DEFAULT_DEPS): Promise<Buffer | null> {
  try {
    const page = await safeGet(pageUrl, { maxBytes: PAGE_MAX, truncate: true }, deps);
    if (!page || page.status !== 200) return null;
    let imageUrl: string | null;
    if (page.contentType.startsWith('image/')) {
      // Lien direct vers une image : relue entière (la page a pu être coupée à 1 Mo)
      imageUrl = pageUrl;
    } else {
      imageUrl = findPreviewImageUrl(page.body.toString('utf8'), pageUrl);
    }
    if (!imageUrl) return null;
    const img = await safeGet(imageUrl, { maxBytes: IMAGE_MAX, truncate: false }, deps);
    if (!img || img.status !== 200 || !img.contentType.startsWith('image/') || img.contentType.includes('svg')) return null;
    const meta = await sharp(img.body).metadata();
    return meta.format && IMAGE_FORMATS.has(meta.format) ? img.body : null;
  } catch {
    return null;
  }
}

/**
 * Récupère et range l'aperçu d'un contenu lien ; met previewUrl seulement si le lien a toujours la même adresse.
 * Renvoie { previewUrl, previous } (previous = ancienne image, à effacer par l'appelant) ou null.
 */
export async function storeLinkPreview(
  prisma: any, content: { id: string; itemId: string; kind: string; url?: string | null; previewUrl?: string | null },
  deps?: LinkPreviewDeps,
): Promise<{ previewUrl: string; previous: string | null } | null> {
  if (content.kind !== 'LINK' || !content.url || !isR2Configured()) return null;
  const buffer = await fetchLinkPreview(content.url, deps);
  if (!buffer) return null;
  const webp = await processImage(buffer).catch(() => null);
  if (!webp) return null;
  const previewUrl = await uploadImageToR2(webp, content.itemId);
  const res = await prisma.itemContent.updateMany({ where: { id: content.id, url: content.url }, data: { previewUrl } });
  if (!res?.count) {
    // Lien retiré ou adresse changée entre-temps : l'image rangée ne sert à rien
    await deleteFileFromR2(previewUrl).catch(() => {});
    return null;
  }
  return { previewUrl, previous: content.previewUrl ?? null };
}

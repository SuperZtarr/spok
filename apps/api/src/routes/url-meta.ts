/* Métadonnées d'une URL (title/description/favicon) pour l'aperçu des items LINK — fetch côté serveur. */
import { FastifyPluginAsync } from 'fastify';

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
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

export const urlMetaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/url-meta', async (request, reply) => {
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

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SPOK-LinkPreview/1.0',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { title: null, description: null, favicon: `${parsed.origin}/favicon.ico` };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return { title: null, description: null, favicon: `${parsed.origin}/favicon.ico` };
      }

      // Read only the first 50KB to find meta tags
      const reader = response.body?.getReader();
      if (!reader) {
        return { title: null, description: null, favicon: `${parsed.origin}/favicon.ico` };
      }

      let html = '';
      const decoder = new TextDecoder();
      while (html.length < 50000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();

      const meta = extractMeta(html, response.url || url);

      // Cache for 24h
      reply.header('Cache-Control', 'public, max-age=86400');
      return meta;
    } catch (err: any) {
      // Timeout or network error — return empty
      return { title: null, description: null, favicon: `${parsed.origin}/favicon.ico` };
    }
  });
};

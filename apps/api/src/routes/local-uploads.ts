/*
 * GET /local-uploads/* — sert les fichiers du stockage LOCAL de dev (utils/r2.ts, mode local : pas de R2 et
 * NODE_ENV !== 'production'). Enregistrée par index.ts UNIQUEMENT dans ce mode : en prod, la route n'existe pas.
 * Chemin vérifié par localPathForKey (aucune sortie du dossier .local-uploads). Lecture publique, comme une URL
 * R2 publique : les URLs ne sont connues que des utilisateurs qui voient l'item.
 */
import { FastifyPluginAsync } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { localPathForKey } from '../utils/r2.js';

const MIME: Record<string, string> = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json', '.csv': 'text/csv; charset=utf-8',
};

export const localUploadsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { '*': string } }>('/*', async (request, reply) => {
    const full = localPathForKey(decodeURIComponent(request.params['*'] ?? ''));
    if (!full) return reply.badRequest('Chemin invalide');
    try {
      const body = await readFile(full);
      const type = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
      // SVG : jamais interprété comme document (scripts) — téléchargé au lieu d'être rendu en page
      if (type === 'image/svg+xml') reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      return reply.type(type).header('Cache-Control', 'no-cache').send(body);
    } catch {
      return reply.notFound('Fichier introuvable');
    }
  });
};

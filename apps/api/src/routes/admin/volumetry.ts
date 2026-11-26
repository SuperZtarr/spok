/* Admin volumétrie (préfixe /admin/volumetry, admin seulement).
   - GET /                        : taille réelle, lignes et croissance de chaque table, taille de la base, niveau face aux
                                    seuils du registre @spok/shared volumetry.ts. Lecture seule : la purge des tables reste
                                    sur les pages dédiées (purgeRoute). Mesure et alertes : utils/volumetryWatch.ts.
   Stockage de fichiers (corbeille du stockage, décision Thomas 2026-11-26 — règles : utils/storageTrash.ts) :
   - GET    /storage              : volume des fichiers d'éléments actifs et de la corbeille, face au seuil.
   - GET    /storage/trash        : fichiers en corbeille (origine, motif, date d'effacement prévue).
   - POST   /storage/trash/purge { ids } : « Effacer maintenant » — DÉFINITIF, la restauration ne pourra plus les rendre.
   - GET    /storage/orphans      : fichiers d'éléments que plus rien n'utilise, hors corbeille (lecture de tout le bucket :
                                    à la demande seulement).
   - POST   /storage/orphans/trash { keys } : « Mettre à la corbeille » — chaque clé re-contrôlée (encore inutilisée)
                                    avant d'être déplacée ; effacement après le délai de grâce. */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { measureVolumetry } from '../../utils/volumetryWatch.js';
import { measureStorage, listTrash, purgeTrashEntries, findOrphans, trashOrphans } from '../../utils/storageTrash.js';

const idsSchema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(5000) });
const keysSchema = z.object({ keys: z.array(z.string().min(1).max(1024)).min(1).max(5000) });

export const adminVolumetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  fastify.get('/', async () => measureVolumetry(fastify.prisma));

  fastify.get('/storage', async () => measureStorage());

  fastify.get('/storage/trash', async () => listTrash(fastify.prisma));

  fastify.post('/storage/trash/purge', async (request) => {
    const { ids } = idsSchema.parse(request.body);
    return { purged: await purgeTrashEntries(fastify.prisma, ids) };
  });

  fastify.get('/storage/orphans', async () => findOrphans(fastify.prisma));

  fastify.post('/storage/orphans/trash', async (request) => {
    const { keys } = keysSchema.parse(request.body);
    return { trashed: await trashOrphans(fastify.prisma, keys, request.log) };
  });
};

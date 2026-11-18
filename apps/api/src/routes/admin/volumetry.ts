/* GET /admin/volumetry (admin) : taille réelle, lignes et croissance de chaque table, taille de la base, niveau face
   aux seuils du registre @spok/shared volumetry.ts. Lecture seule : la purge reste sur les pages dédiées (purgeRoute).
   Mesure et alertes : utils/volumetryWatch.ts. */
import { FastifyPluginAsync } from 'fastify';
import { measureVolumetry } from '../../utils/volumetryWatch.js';

export const adminVolumetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  fastify.get('/', async () => measureVolumetry(fastify.prisma));
};

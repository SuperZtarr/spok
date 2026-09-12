/*
 * Routes /item-templates : modèles de structures d'items (titre+type, récursif), portée globale
 * — partagés par tous les utilisateurs. Utilisés par le picker d'insertion (POST /spaces/:id/
 * items/from-template) et le bouton "Enregistrer comme modèle" d'ItemEditModal.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// z.ZodTypeAny (plutôt qu'un ZodType<T> précis) : Zod ne parvient pas à inférer un type
// TypeScript propre pour un schéma auto-référencé via z.lazy — la validation runtime reste
// complète, seul le typage statique est relâché ici.
const nodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    children: z.array(nodeSchema),
  })
);

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  structure: nodeSchema,
});

export const itemTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // List all templates (global scope), sorted by name for the picker
  fastify.get('/', async (_request, reply) => {
    const templates = await fastify.prisma.itemTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { createdBy: { select: { name: true } } },
    });
    return reply.send(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        structure: t.structure,
        createdById: t.createdById,
        createdByName: t.createdBy.name,
        createdAt: t.createdAt,
      }))
    );
  });

  // Create a template
  fastify.post('/', async (request, reply) => {
    const body = createTemplateSchema.parse(request.body);
    const template = await fastify.prisma.itemTemplate.create({
      data: {
        name: body.name,
        description: body.description,
        structure: body.structure,
        createdById: request.user.userId,
      },
      include: { createdBy: { select: { name: true } } },
    });
    return reply.status(201).send({
      id: template.id,
      name: template.name,
      description: template.description,
      structure: template.structure,
      createdById: template.createdById,
      createdByName: template.createdBy.name,
      createdAt: template.createdAt,
    });
  });

  // Delete a template — creator only
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const template = await fastify.prisma.itemTemplate.findUnique({ where: { id: request.params.id } });
    if (!template) {
      return reply.notFound('Template not found');
    }
    if (template.createdById !== request.user.userId) {
      return reply.forbidden('Only the creator can delete this template');
    }
    await fastify.prisma.itemTemplate.delete({ where: { id: request.params.id } });
    return reply.send({ success: true });
  });
};

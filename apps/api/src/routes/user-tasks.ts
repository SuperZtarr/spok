import { FastifyPluginAsync } from 'fastify';

export const userTasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /user/tasks — List all TASK items across user's accessible spaces
  fastify.get<{
    Querystring: {
      status?: string;
      priority?: string;
      spaceId?: string;
      search?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      sortBy?: string;
      sortDir?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/tasks', async (request) => {
    const {
      status,
      priority: priorityStr,
      spaceId: filterSpaceId,
      search,
      dueDateFrom,
      dueDateTo,
      sortBy = 'createdAt',
      sortDir = 'desc',
      page: pageStr = '1',
      pageSize: pageSizeStr = '30',
    } = request.query;

    const page = Math.max(1, parseInt(pageStr, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10)));
    const priority = priorityStr ? parseInt(priorityStr, 10) : undefined;
    const skip = (page - 1) * pageSize;

    // 1. Resolve accessible spaceIds based on user role
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { globalRole: true },
    });
    const isAdmin = user?.globalRole === 'ADMIN';

    let spaceIds: string[] | undefined;
    if (!isAdmin) {
      // Direct space memberships
      const directMemberships = await fastify.prisma.spaceMembership.findMany({
        where: { userId: request.user.userId },
        select: { spaceId: true },
      });
      const directSpaceIds = directMemberships.map((m) => m.spaceId);

      // Community memberships → all spaces in those communities
      const communityMemberships = await fastify.prisma.communityMembership.findMany({
        where: { userId: request.user.userId },
        select: { communityId: true },
      });
      const communityIds = communityMemberships.map((m) => m.communityId);

      let communitySpaceIds: string[] = [];
      if (communityIds.length > 0) {
        const communitySpaces = await fastify.prisma.space.findMany({
          where: { communityId: { in: communityIds } },
          select: { id: true },
        });
        communitySpaceIds = communitySpaces.map((s) => s.id);
      }

      spaceIds = [...new Set([...directSpaceIds, ...communitySpaceIds])];
      if (spaceIds.length === 0) {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }

    // 2. Build where clause
    const where: Record<string, unknown> = {
      type: 'TASK',
    };

    // Space access filter
    if (spaceIds) {
      where.spaceId = { in: spaceIds };
    }

    // Optional space filter
    if (filterSpaceId) {
      where.spaceId = filterSpaceId;
    }

    if (status) {
      if (status === 'none') {
        where.status = null;
      } else {
        where.status = status;
      }
    }

    if (priority && priority >= 1 && priority <= 4) {
      where.priority = priority;
    }

    // Due date range
    if (dueDateFrom || dueDateTo) {
      const dueDateFilter: Record<string, Date> = {};
      if (dueDateFrom) dueDateFilter.gte = new Date(dueDateFrom);
      if (dueDateTo) dueDateFilter.lte = new Date(dueDateTo);
      where.dueDate = dueDateFilter;
    }

    // Text search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 3. Sort
    const validSortBy = ['dueDate', 'status', 'spaceName', 'createdAt', 'priority', 'title'];
    const validSortDir = ['asc', 'desc'];
    const safeSortBy = validSortBy.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortDir = validSortDir.includes(sortDir) ? sortDir : 'desc';

    let orderBy: unknown;
    if (safeSortBy === 'spaceName') {
      orderBy = { space: { name: safeSortDir } };
    } else {
      orderBy = { [safeSortBy]: safeSortDir };
    }

    // 4. Query
    const [tasks, total] = await Promise.all([
      fastify.prisma.item.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          spaceId: true,
          createdById: true,
          parentId: true,
          description: true,
          space: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          parent: { select: { id: true, title: true } },
          tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      fastify.prisma.item.count({ where }),
    ]);

    return {
      data: tasks.map((t) => ({
        ...t,
        spaceName: t.space.name,
        createdByName: t.createdBy.name,
        tags: t.tags.map((it) => it.tag),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });
};

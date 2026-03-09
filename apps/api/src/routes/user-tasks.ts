import { FastifyPluginAsync } from 'fastify';

export const userTasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /user/tasks — List items across user's accessible spaces
  // Supports multi-value filters via comma-separated strings:
  //   type=TASK,PROJECT  status=todo,in_progress  priority=1,2  spaceId=id1,id2
  fastify.get<{
    Querystring: {
      type?: string;
      status?: string;
      priority?: string;
      spaceId?: string;
      search?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      noDueDate?: string;
      assignedToMe?: string;
      sortBy?: string;
      sortDir?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/tasks', async (request) => {
    const {
      type: typeFilter,
      status,
      priority: priorityStr,
      spaceId: filterSpaceId,
      search,
      dueDateFrom,
      dueDateTo,
      noDueDate,
      assignedToMe,
      sortBy = 'createdAt',
      sortDir = 'desc',
      page: pageStr = '1',
      pageSize: pageSizeStr = '30',
    } = request.query;

    const page = Math.max(1, parseInt(pageStr, 10));
    const pageSize = Math.min(500, Math.max(1, parseInt(pageSizeStr, 10)));
    const skip = (page - 1) * pageSize;

    // 1. Resolve accessible spaceIds based on user role
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { globalRole: true },
    });
    const isAdmin = user?.globalRole === 'ADMIN';

    let accessibleSpaceIds: string[] | undefined;
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

      accessibleSpaceIds = [...new Set([...directSpaceIds, ...communitySpaceIds])];
      if (accessibleSpaceIds.length === 0) {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }

    // 2. Build where clause
    const where: Record<string, unknown> = {};

    // Type filter (supports multiple comma-separated values, defaults to TASK)
    if (typeFilter) {
      const validTypes = ['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG'];
      const typeList = typeFilter.split(',').filter((t) => validTypes.includes(t));
      if (typeList.length === 1) {
        where.type = typeList[0];
      } else if (typeList.length > 1) {
        where.type = { in: typeList };
      } else {
        where.type = 'TASK';
      }
    } else {
      where.type = 'TASK';
    }

    // Space access filter
    if (accessibleSpaceIds) {
      where.spaceId = { in: accessibleSpaceIds };
    }

    // Optional space filter (supports multiple comma-separated IDs)
    if (filterSpaceId) {
      const spaceIdList = filterSpaceId.split(',').filter(Boolean);
      if (spaceIdList.length === 1) {
        // Single space — also intersect with accessible spaces
        where.spaceId = spaceIdList[0];
      } else if (spaceIdList.length > 1) {
        // Multiple spaces — intersect with accessible ones
        if (accessibleSpaceIds) {
          const accessibleSet = new Set(accessibleSpaceIds);
          const filtered = spaceIdList.filter((id) => accessibleSet.has(id));
          where.spaceId = { in: filtered };
        } else {
          where.spaceId = { in: spaceIdList };
        }
      }
    }

    // Status filter (supports multiple comma-separated values, 'none' = null)
    if (status) {
      const statusList = status.split(',').filter(Boolean);
      const hasNone = statusList.includes('none');
      const realStatuses = statusList.filter((s) => s !== 'none');

      if (hasNone && realStatuses.length > 0) {
        // Combine null + specific statuses
        where.OR = [
          { status: null },
          { status: { in: realStatuses } },
        ];
      } else if (hasNone) {
        where.status = null;
      } else if (realStatuses.length === 1) {
        where.status = realStatuses[0];
      } else if (realStatuses.length > 1) {
        where.status = { in: realStatuses };
      }
    }

    // Priority filter (supports multiple comma-separated values)
    if (priorityStr) {
      const priorities = priorityStr
        .split(',')
        .map((p) => parseInt(p, 10))
        .filter((p) => p >= 1 && p <= 4);
      if (priorities.length === 1) {
        where.priority = priorities[0];
      } else if (priorities.length > 1) {
        where.priority = { in: priorities };
      }
    }

    // Due date filters
    if (noDueDate === 'true') {
      where.dueDate = null;
    } else if (dueDateFrom || dueDateTo) {
      const dueDateFilter: Record<string, Date> = {};
      if (dueDateFrom) dueDateFilter.gte = new Date(dueDateFrom);
      if (dueDateTo) dueDateFilter.lte = new Date(dueDateTo);
      where.dueDate = dueDateFilter;
    }

    // Assigned to me filter
    if (assignedToMe === 'true') {
      where.assignedToId = request.user.userId;
    }

    // Text search
    if (search) {
      // If we already have an OR (from status filter), we need AND to combine
      if (where.OR) {
        const statusOr = where.OR;
        delete where.OR;
        where.AND = [
          { OR: statusOr as Record<string, unknown>[] },
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          },
        ];
      } else {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
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
          assignedToId: true,
          parentId: true,
          description: true,
          space: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
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
        assignedToName: t.assignedTo?.name || null,
        tags: t.tags.map((it) => it.tag),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });
};

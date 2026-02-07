import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@spok/database';

type Severity = 'error' | 'warning' | 'info';

interface AnomalyCategory {
  key: string;
  label: string;
  group: string;
  severity: Severity;
  count: number;
}

interface AnomalyItem {
  id: string;
  title: string;
  spaceId?: string | null;
  spaceName?: string | null;
  detail?: string;
}

interface CategoryParams {
  category: string;
}

interface CategoryQuery {
  page?: number;
  pageSize?: number;
}

export const adminAnomaliesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/anomalies - Summary (counts)
  fastify.get('/', async () => {
    const prisma = fastify.prisma;

    const [
      itemsShortDesc,
      itemsGenericTitle,
      itemsMojibake,
      itemsOrphan,
      itemsDuplicateTitle,
      itemsNoSpace,
      spacesNoCommunity,
      spacesEmpty,
      spacesNoMembers,
      contributionsShort,
      relationsSelf,
      relationsCrossSpace,
    ] = await Promise.all([
      // Items with short description that have contributions
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT i.id) as count
        FROM items i
        JOIN contributions c ON c."itemId" = i.id
        WHERE (i.description IS NULL OR LENGTH(i.description) < 10)
      `,
      // Generic titles like "Topic N" or pure numbers
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM items
        WHERE title ~ '^Topic [0-9]+$' OR title ~ '^[0-9]+$'
      `,
      // Mojibake (corrupted encoding - 2-byte latin + 3-byte CJK)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM items
        WHERE title ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}' OR (description IS NOT NULL AND description ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}')
      `,
      // Orphan items (no parent, no children, no relations)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM items i
        WHERE i."parentId" IS NULL
          AND NOT EXISTS (SELECT 1 FROM items c WHERE c."parentId" = i.id)
          AND NOT EXISTS (SELECT 1 FROM item_relations r WHERE r."fromItemId" = i.id OR r."toItemId" = i.id)
      `,
      // Duplicate titles in same space
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT title, "spaceId" FROM items
          GROUP BY "spaceId", title
          HAVING COUNT(*) > 1
        ) dupes
      `,
      // Items without space (should be 0 due to FK)
      prisma.item.count({ where: { spaceId: '' } }).catch(() => 0),
      // Spaces GROUP without community
      prisma.space.count({ where: { type: 'GROUP', communityId: null } }),
      // Empty spaces (no items)
      prisma.space.count({ where: { items: { none: {} } } }),
      // Spaces without members
      prisma.space.count({ where: { memberships: { none: {} } } }),
      // Short contributions (< 5 chars)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM contributions
        WHERE LENGTH(content) < 5
      `,
      // Self-referencing relations
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM item_relations
        WHERE "fromItemId" = "toItemId"
      `,
      // Cross-space relations
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM item_relations r
        JOIN items i1 ON r."fromItemId" = i1.id
        JOIN items i2 ON r."toItemId" = i2.id
        WHERE i1."spaceId" != i2."spaceId"
      `,
    ]);

    const toNum = (v: unknown): number => {
      if (typeof v === 'number') return v;
      if (Array.isArray(v) && v[0]?.count !== undefined) return Number(v[0].count);
      return Number(v) || 0;
    };

    const categories: AnomalyCategory[] = [
      { key: 'items-short-description', label: 'Items sans description (avec contributions)', group: 'Items', severity: 'warning', count: toNum(itemsShortDesc) },
      { key: 'items-generic-title', label: 'Titres génériques (Topic N, nombres)', group: 'Items', severity: 'warning', count: toNum(itemsGenericTitle) },
      { key: 'items-mojibake', label: 'Encodage corrompu (mojibake)', group: 'Items', severity: 'error', count: toNum(itemsMojibake) },
      { key: 'items-orphan', label: 'Items orphelins (sans liens)', group: 'Items', severity: 'info', count: toNum(itemsOrphan) },
      { key: 'items-duplicate-title', label: 'Titres dupliqués dans le même espace', group: 'Items', severity: 'warning', count: toNum(itemsDuplicateTitle) },
      { key: 'items-no-space', label: 'Items sans espace', group: 'Items', severity: 'error', count: toNum(itemsNoSpace) },
      { key: 'spaces-no-community', label: 'Espaces GROUP sans communauté', group: 'Espaces', severity: 'warning', count: toNum(spacesNoCommunity) },
      { key: 'spaces-empty', label: 'Espaces sans éléments', group: 'Espaces', severity: 'info', count: toNum(spacesEmpty) },
      { key: 'spaces-no-members', label: 'Espaces sans membres', group: 'Espaces', severity: 'error', count: toNum(spacesNoMembers) },
      { key: 'contributions-short', label: 'Contributions très courtes (< 5 car.)', group: 'Contributions', severity: 'info', count: toNum(contributionsShort) },
      { key: 'relations-self', label: 'Auto-références (from = to)', group: 'Relations', severity: 'error', count: toNum(relationsSelf) },
      { key: 'relations-cross-space', label: 'Relations entre espaces différents', group: 'Relations', severity: 'info', count: toNum(relationsCrossSpace) },
    ];

    const totalAnomalies = categories.reduce((sum, c) => sum + c.count, 0);

    return {
      categories,
      totalAnomalies,
      checkedAt: new Date().toISOString(),
    };
  });

  // GET /admin/anomalies/:category - Detail (paginated)
  fastify.get<{ Params: CategoryParams; Querystring: CategoryQuery }>(
    '/:category',
    async (request) => {
      const { category } = request.params;
      const page = Number(request.query.page) || 1;
      const pageSize = Number(request.query.pageSize) || 50;
      const skip = (page - 1) * pageSize;
      const prisma = fastify.prisma;

      let items: AnomalyItem[] = [];
      let total = 0;
      let severity: Severity = 'info';

      switch (category) {
        case 'items-short-description': {
          severity = 'warning';
          const rows = await prisma.$queryRaw<Array<{ id: string; title: string; spaceId: string; spaceName: string; description: string | null; contribCount: bigint }>>`
            SELECT DISTINCT i.id, i.title, i."spaceId", s.name as "spaceName", i.description,
              (SELECT COUNT(*) FROM contributions c WHERE c."itemId" = i.id) as "contribCount"
            FROM items i
            JOIN spaces s ON i."spaceId" = s.id
            JOIN contributions c ON c."itemId" = i.id
            WHERE (i.description IS NULL OR LENGTH(i.description) < 10)
            ORDER BY i.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT i.id) as count
            FROM items i
            JOIN contributions c ON c."itemId" = i.id
            WHERE (i.description IS NULL OR LENGTH(i.description) < 10)
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.title,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: r.description
              ? `"${r.description.substring(0, 50)}" (${Number(r.contribCount)} contrib.)`
              : `Aucune description (${Number(r.contribCount)} contrib.)`,
          }));
          break;
        }

        case 'items-generic-title': {
          severity = 'warning';
          const rows = await prisma.$queryRaw<Array<{ id: string; title: string; spaceId: string; spaceName: string }>>`
            SELECT i.id, i.title, i."spaceId", s.name as "spaceName"
            FROM items i
            JOIN spaces s ON i."spaceId" = s.id
            WHERE i.title ~ '^Topic [0-9]+$' OR i.title ~ '^[0-9]+$'
            ORDER BY i.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM items
            WHERE title ~ '^Topic [0-9]+$' OR title ~ '^[0-9]+$'
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.title,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: `"${r.title}"`,
          }));
          break;
        }

        case 'items-mojibake': {
          severity = 'error';
          const rows = await prisma.$queryRaw<Array<{ id: string; title: string; spaceId: string; spaceName: string; description: string | null }>>`
            SELECT i.id, i.title, i."spaceId", s.name as "spaceName", LEFT(i.description, 100) as description
            FROM items i
            JOIN spaces s ON i."spaceId" = s.id
            WHERE i.title ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}' OR (i.description IS NOT NULL AND i.description ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}')
            ORDER BY i.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM items
            WHERE title ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}' OR (description IS NOT NULL AND description ~ '[Â-ß][€-¿]|[à-ï][€-¿]{2}')
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.title,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: r.description ? r.description.substring(0, 80) : undefined,
          }));
          break;
        }

        case 'items-orphan': {
          severity = 'info';
          const rows = await prisma.$queryRaw<Array<{ id: string; title: string; spaceId: string; spaceName: string; type: string }>>`
            SELECT i.id, i.title, i."spaceId", s.name as "spaceName", i.type
            FROM items i
            JOIN spaces s ON i."spaceId" = s.id
            WHERE i."parentId" IS NULL
              AND NOT EXISTS (SELECT 1 FROM items c WHERE c."parentId" = i.id)
              AND NOT EXISTS (SELECT 1 FROM item_relations r WHERE r."fromItemId" = i.id OR r."toItemId" = i.id)
            ORDER BY i.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM items i
            WHERE i."parentId" IS NULL
              AND NOT EXISTS (SELECT 1 FROM items c WHERE c."parentId" = i.id)
              AND NOT EXISTS (SELECT 1 FROM item_relations r WHERE r."fromItemId" = i.id OR r."toItemId" = i.id)
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.title,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: r.type,
          }));
          break;
        }

        case 'items-duplicate-title': {
          severity = 'warning';
          const rows = await prisma.$queryRaw<Array<{ title: string; spaceId: string; spaceName: string; cnt: bigint }>>`
            SELECT i.title, i."spaceId", s.name as "spaceName", COUNT(*) as cnt
            FROM items i
            JOIN spaces s ON i."spaceId" = s.id
            GROUP BY i."spaceId", i.title, s.name
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM (
              SELECT title, "spaceId" FROM items
              GROUP BY "spaceId", title
              HAVING COUNT(*) > 1
            ) dupes
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: `${r.spaceId}:${r.title}`,
            title: r.title,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: `${Number(r.cnt)} copies`,
          }));
          break;
        }

        case 'items-no-space': {
          severity = 'error';
          // FK constraint should prevent this, but check anyway
          items = [];
          total = 0;
          break;
        }

        case 'spaces-no-community': {
          severity = 'warning';
          const countResult = await prisma.space.count({ where: { type: 'GROUP', communityId: null } });
          total = countResult;
          const rows = await prisma.space.findMany({
            where: { type: 'GROUP', communityId: null },
            select: { id: true, name: true, type: true, _count: { select: { items: true, memberships: true } } },
            skip,
            take: pageSize,
            orderBy: { name: 'asc' },
          });
          items = rows.map(r => ({
            id: r.id,
            title: r.name,
            detail: `${r._count.items} items, ${r._count.memberships} membres`,
          }));
          break;
        }

        case 'spaces-empty': {
          severity = 'info';
          const countResult = await prisma.space.count({ where: { items: { none: {} } } });
          total = countResult;
          const rows = await prisma.space.findMany({
            where: { items: { none: {} } },
            select: {
              id: true, name: true, type: true,
              community: { select: { name: true } },
              _count: { select: { memberships: true } },
            },
            skip,
            take: pageSize,
            orderBy: { name: 'asc' },
          });
          items = rows.map(r => ({
            id: r.id,
            title: r.name,
            detail: `${r.type}${r.community ? ` (${r.community.name})` : ''} - ${r._count.memberships} membres`,
          }));
          break;
        }

        case 'spaces-no-members': {
          severity = 'error';
          const countResult = await prisma.space.count({ where: { memberships: { none: {} } } });
          total = countResult;
          const rows = await prisma.space.findMany({
            where: { memberships: { none: {} } },
            select: {
              id: true, name: true, type: true,
              community: { select: { name: true } },
              _count: { select: { items: true } },
            },
            skip,
            take: pageSize,
            orderBy: { name: 'asc' },
          });
          items = rows.map(r => ({
            id: r.id,
            title: r.name,
            detail: `${r.type}${r.community ? ` (${r.community.name})` : ''} - ${r._count.items} items`,
          }));
          break;
        }

        case 'contributions-short': {
          severity = 'info';
          const rows = await prisma.$queryRaw<Array<{ id: string; content: string; itemId: string; itemTitle: string; spaceId: string; spaceName: string }>>`
            SELECT c.id, c.content, c."itemId", i.title as "itemTitle", i."spaceId", s.name as "spaceName"
            FROM contributions c
            JOIN items i ON c."itemId" = i.id
            JOIN spaces s ON i."spaceId" = s.id
            WHERE LENGTH(c.content) < 5
            ORDER BY c."createdAt" DESC
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM contributions WHERE LENGTH(content) < 5
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.itemTitle,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: `"${r.content}"`,
          }));
          break;
        }

        case 'relations-self': {
          severity = 'error';
          const rows = await prisma.$queryRaw<Array<{ id: string; fromItemId: string; type: string; itemTitle: string; spaceId: string; spaceName: string }>>`
            SELECT r.id, r."fromItemId", r.type, i.title as "itemTitle", i."spaceId", s.name as "spaceName"
            FROM item_relations r
            JOIN items i ON r."fromItemId" = i.id
            JOIN spaces s ON i."spaceId" = s.id
            WHERE r."fromItemId" = r."toItemId"
            ORDER BY i.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM item_relations WHERE "fromItemId" = "toItemId"
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: r.itemTitle,
            spaceId: r.spaceId,
            spaceName: r.spaceName,
            detail: `Type: ${r.type}`,
          }));
          break;
        }

        case 'relations-cross-space': {
          severity = 'info';
          const rows = await prisma.$queryRaw<Array<{ id: string; fromTitle: string; toTitle: string; fromSpace: string; toSpace: string; fromSpaceId: string; type: string }>>`
            SELECT r.id, i1.title as "fromTitle", i2.title as "toTitle",
              s1.name as "fromSpace", s2.name as "toSpace", i1."spaceId" as "fromSpaceId", r.type
            FROM item_relations r
            JOIN items i1 ON r."fromItemId" = i1.id
            JOIN items i2 ON r."toItemId" = i2.id
            JOIN spaces s1 ON i1."spaceId" = s1.id
            JOIN spaces s2 ON i2."spaceId" = s2.id
            WHERE i1."spaceId" != i2."spaceId"
            ORDER BY s1.name, i1.title
            LIMIT ${pageSize} OFFSET ${skip}
          `;
          const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM item_relations r
            JOIN items i1 ON r."fromItemId" = i1.id
            JOIN items i2 ON r."toItemId" = i2.id
            WHERE i1."spaceId" != i2."spaceId"
          `;
          total = Number(countResult[0].count);
          items = rows.map(r => ({
            id: r.id,
            title: `${r.fromTitle} → ${r.toTitle}`,
            spaceId: r.fromSpaceId,
            spaceName: `${r.fromSpace} → ${r.toSpace}`,
            detail: `Type: ${r.type}`,
          }));
          break;
        }

        default:
          throw fastify.httpErrors.notFound(`Catégorie inconnue: ${category}`);
      }

      return {
        category,
        severity,
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }
  );
};

/*
 * Doublons (admin) : éléments au même titre, contenus Lien à la même adresse, contenus Image/Fichier au même nom de
 * fichier. Depuis le lot 4 « contenus multiples » (2026-11-11), adresses et fichiers se lisent dans item_contents
 * (plus d'Item.url ni de types Lien / Image / Document) ; un élément n'apparaît qu'une fois par groupe.
 */
import { FastifyPluginAsync } from 'fastify';

interface RawItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  priority: number | null;
  createdAt: string;
  spaceId: string;
  spaceName: string;
  communityId: string | null;
  communityName: string | null;
  ownerName: string | null;
  parentId: string | null;
  parentTitle: string | null;
  grandparentId: string | null;
  grandparentTitle: string | null;
}

interface Ancestor {
  id: string;
  title: string;
}

interface DuplicateItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  priority: number | null;
  createdAt: string;
  spaceId: string;
  spaceName: string;
  communityId: string | null;
  communityName: string | null;
  ownerName: string | null;
  ancestors: Ancestor[]; // [grandparent?, parent?] — nearest last
}

interface DuplicateGroup {
  key: string;
  reason: 'title' | 'url' | 'filename';
  items: DuplicateItem[];
}

// Two levels of parent JOINs for breadcrumb + space owner
const ITEM_SELECT = `
  i.id, i.title, i.type, NULL::text as url, i.status, i.priority,
  i."createdAt"::text as "createdAt", i."spaceId",
  s.name as "spaceName", s."communityId",
  c.name as "communityName",
  ou.name as "ownerName",
  p.id as "parentId", p.title as "parentTitle",
  gp.id as "grandparentId", gp.title as "grandparentTitle"
FROM items i
JOIN spaces s ON s.id = i."spaceId"
LEFT JOIN communities c ON c.id = s."communityId"
LEFT JOIN space_memberships sm ON sm."spaceId" = s.id AND sm.role = 'OWNER'
LEFT JOIN users ou ON ou.id = sm."userId"
LEFT JOIN items p ON p.id = i."parentId"
LEFT JOIN items gp ON gp.id = p."parentId"
`;

// Même sélection pour un élément trouvé par l'un de ses contenus (ic) : url = adresse de ce contenu
const CONTENT_ITEM_SELECT = ITEM_SELECT
  .replace('NULL::text as url', 'ic.url as url')
  .replace('FROM items i', 'FROM item_contents ic\nJOIN items i ON i.id = ic."itemId"');

const FILE_NAME_SQL = `COALESCE(NULLIF(ic.name, ''), REGEXP_REPLACE(ic.url, '^.+/', ''))`;

function toItem(r: RawItem): DuplicateItem {
  const ancestors: Ancestor[] = [];
  if (r.grandparentId && r.grandparentTitle) {
    ancestors.push({ id: r.grandparentId, title: r.grandparentTitle });
  }
  if (r.parentId && r.parentTitle) {
    ancestors.push({ id: r.parentId, title: r.parentTitle });
  }
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    status: r.status,
    priority: r.priority,
    createdAt: r.createdAt,
    spaceId: r.spaceId,
    spaceName: r.spaceName,
    communityId: r.communityId,
    communityName: r.communityName,
    ownerName: r.ownerName,
    ancestors,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

export const adminDuplicatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/duplicates
  fastify.get('/', async () => {
    const prisma = fastify.prisma;
    const groups: DuplicateGroup[] = [];

    // ── 1. Duplicate titles (all types) ──────────────────────────────
    const titleKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT LOWER(TRIM(REGEXP_REPLACE(title, '\\s+', ' ', 'g'))) as key
      FROM items
      GROUP BY key
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 200
    `);

    if (titleKeys.length > 0) {
      const placeholders = titleKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = titleKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<RawItem[]>(
        `SELECT ${ITEM_SELECT}
         WHERE LOWER(TRIM(REGEXP_REPLACE(i.title, '\\s+', ' ', 'g'))) IN (${placeholders})
         ORDER BY LOWER(TRIM(REGEXP_REPLACE(i.title, '\\s+', ' ', 'g'))), i."createdAt"`,
        ...keys
      );
      const grouped = groupBy(items, (r) =>
        r.title.toLowerCase().trim().replace(/\s+/g, ' ')
      );
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'title', items: groupItems.map(toItem) });
      }
    }

    // ── 2. Contenus Lien à la même adresse (éléments distincts) ─────────
    const urlKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT ic.url as key
      FROM item_contents ic
      WHERE ic.kind = 'LINK' AND ic.url IS NOT NULL AND ic.url <> ''
      GROUP BY ic.url
      HAVING COUNT(DISTINCT ic."itemId") > 1
      ORDER BY COUNT(DISTINCT ic."itemId") DESC
      LIMIT 200
    `);

    if (urlKeys.length > 0) {
      const placeholders = urlKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = urlKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<RawItem[]>(
        `SELECT DISTINCT ON (ic.url, i.id) ${CONTENT_ITEM_SELECT}
         WHERE ic.kind = 'LINK' AND ic.url IN (${placeholders})
         ORDER BY ic.url, i.id`,
        ...keys
      );
      const grouped = groupBy(items, (r) => r.url ?? '');
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'url', items: groupItems.map(toItem) });
      }
    }

    // ── 3. Contenus Image / Fichier au même nom de fichier ────────────────
    const fileKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT ${FILE_NAME_SQL} as key
      FROM item_contents ic
      WHERE ic.kind IN ('IMAGE', 'FILE') AND ic.url IS NOT NULL AND ic.url <> ''
      GROUP BY key
      HAVING COUNT(DISTINCT ic."itemId") > 1
      ORDER BY COUNT(DISTINCT ic."itemId") DESC
      LIMIT 200
    `);

    if (fileKeys.length > 0) {
      const placeholders = fileKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = fileKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<(RawItem & { fileName: string })[]>(
        `SELECT DISTINCT ON (${FILE_NAME_SQL}, i.id) ${CONTENT_ITEM_SELECT.replace('ic.url as url', `ic.url as url, ${FILE_NAME_SQL} as "fileName"`)}
         WHERE ic.kind IN ('IMAGE', 'FILE') AND ${FILE_NAME_SQL} IN (${placeholders})
         ORDER BY ${FILE_NAME_SQL}, i.id`,
        ...keys
      );
      const grouped = groupBy(items, (r) => r.fileName);
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'filename', items: groupItems.map(toItem) });
      }
    }

    return { groups, total: groups.reduce((n, g) => n + g.items.length, 0) };
  });
};

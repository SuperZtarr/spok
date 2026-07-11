/* Exécution des TNR depuis l'admin (spawn vitest) — usage local/debug uniquement. */
import { FastifyPluginAsync } from 'fastify';

interface TestResult {
  key: string;
  label: string;
  group: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  count: number;
  durationMs: number;
}

type TestFn = () => Promise<TestResult>;

async function runTest(fn: TestFn): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    result.durationMs = Date.now() - start;
    return result;
  } catch (err) {
    return {
      key: 'unknown',
      label: 'Test en erreur',
      group: 'Erreur',
      status: 'fail',
      message: err instanceof Error ? err.message : String(err),
      count: 1,
      durationMs: Date.now() - start,
    };
  }
}

export const adminTestsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/tests — Run all non-regression tests
  fastify.get('/', async () => {
    const prisma = fastify.prisma;
    const startAll = Date.now();

    // Helper — handles raw query results like [{count: bigint}] or [{total: bigint}]
    const toNum = (v: unknown): number => {
      if (typeof v === 'number') return v;
      if (Array.isArray(v) && v.length > 0) {
        const row = v[0] as Record<string, unknown>;
        if (row?.count !== undefined) return Number(row.count);
        if (row?.total !== undefined) return Number(row.total);
      }
      return Number(v) || 0;
    };

    // ─── Groupe 1 : Intégrité BD ───

    const dbFkItemsSpaces: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM items i
        WHERE NOT EXISTS (SELECT 1 FROM spaces s WHERE s.id = i."spaceId")
      `;
      const count = toNum(result);
      return {
        key: 'db-fk-items-spaces',
        label: 'Items référençant un espace inexistant',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Aucun item orphelin' : `${count} items sans espace valide`,
        count,
        durationMs: 0,
      };
    };

    const dbFkContributionsItems: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM contributions c
        WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = c."itemId")
      `;
      const count = toNum(result);
      return {
        key: 'db-fk-contributions-items',
        label: 'Contributions référençant un item inexistant',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Toutes les contributions ont un item valide' : `${count} contributions orphelines`,
        count,
        durationMs: 0,
      };
    };

    const dbFkContributionsAuthors: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM contributions c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c."authorId")
      `;
      const count = toNum(result);
      return {
        key: 'db-fk-contributions-authors',
        label: 'Contributions référençant un auteur inexistant',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Tous les auteurs existent' : `${count} contributions sans auteur valide`,
        count,
        durationMs: 0,
      };
    };

    const dbFkMembershipsUsers: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM space_memberships sm
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = sm."userId")
      `;
      const count = toNum(result);
      return {
        key: 'db-fk-memberships-users',
        label: 'Memberships référençant un user inexistant',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Tous les membres existent' : `${count} memberships orphelines`,
        count,
        durationMs: 0,
      };
    };

    const dbFkMembershipsSpaces: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM space_memberships sm
        WHERE NOT EXISTS (SELECT 1 FROM spaces s WHERE s.id = sm."spaceId")
      `;
      const count = toNum(result);
      return {
        key: 'db-fk-memberships-spaces',
        label: 'Memberships référençant un espace inexistant',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Tous les espaces existent' : `${count} memberships sans espace valide`,
        count,
        durationMs: 0,
      };
    };

    const dbUniqueEmails: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
        ) dupes
      `;
      const count = toNum(result);
      return {
        key: 'db-unique-emails',
        label: 'Emails utilisateurs dupliqués',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Aucun doublon d\'email' : `${count} emails dupliqués`,
        count,
        durationMs: 0,
      };
    };

    const dbUniqueTags: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT name, "spaceId" FROM tags GROUP BY "spaceId", name HAVING COUNT(*) > 1
        ) dupes
      `;
      const count = toNum(result);
      return {
        key: 'db-unique-tags',
        label: 'Tags dupliqués dans un même espace',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Aucun tag dupliqué' : `${count} tags dupliqués`,
        count,
        durationMs: 0,
      };
    };

    const dbRequiredFields: TestFn = async () => {
      const [itemsNoTitle, usersNoEmail] = await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM items WHERE title IS NULL OR title = ''
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ''
        `,
      ]);
      const count = toNum(itemsNoTitle) + toNum(usersNoEmail);
      return {
        key: 'db-required-fields',
        label: 'Items sans titre ou users sans email',
        group: 'Intégrité BD',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0
          ? 'Tous les champs requis sont remplis'
          : `${toNum(itemsNoTitle)} items sans titre, ${toNum(usersNoEmail)} users sans email`,
        count,
        durationMs: 0,
      };
    };

    // ─── Groupe 2 : Cohérence métier ───

    const bizUsersPersonalSpace: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM space_memberships sm
          JOIN spaces s ON sm."spaceId" = s.id
          WHERE sm."userId" = u.id AND s.type = 'PERSONAL'
        )
      `;
      const count = toNum(result);
      return {
        key: 'biz-users-personal-space',
        label: 'Users sans espace personnel',
        group: 'Cohérence métier',
        status: count === 0 ? 'pass' : 'warning',
        message: count === 0 ? 'Tous les users ont un espace personnel' : `${count} users sans espace personnel`,
        count,
        durationMs: 0,
      };
    };

    const bizSpacesHaveOwner: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM spaces s
        WHERE NOT EXISTS (
          SELECT 1 FROM space_memberships sm
          WHERE sm."spaceId" = s.id AND sm.role = 'OWNER'
        )
      `;
      const count = toNum(result);
      return {
        key: 'biz-spaces-have-owner',
        label: 'Espaces sans OWNER',
        group: 'Cohérence métier',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Tous les espaces ont un OWNER' : `${count} espaces sans propriétaire`,
        count,
        durationMs: 0,
      };
    };

    const bizGroupSpacesCommunity: TestFn = async () => {
      const count = await prisma.space.count({
        where: { type: 'GROUP', communityId: null },
      });
      return {
        key: 'biz-group-spaces-community',
        label: 'Espaces GROUP sans communauté',
        group: 'Cohérence métier',
        status: count === 0 ? 'pass' : 'warning',
        message: count === 0 ? 'Tous les espaces GROUP ont une communauté' : `${count} espaces GROUP sans communauté`,
        count,
        durationMs: 0,
      };
    };

    const bizItemCountsMatch: TestFn = async () => {
      const [totalItems, sumBySpace] = await Promise.all([
        prisma.item.count(),
        prisma.$queryRaw<[{ total: bigint }]>`
          SELECT COALESCE(SUM(cnt), 0) as total FROM (
            SELECT COUNT(*) as cnt FROM items GROUP BY "spaceId"
          ) sub
        `,
      ]);
      const sumCount = toNum(sumBySpace);
      const diff = Math.abs(totalItems - sumCount);
      return {
        key: 'biz-item-counts-match',
        label: 'Total items = somme par espace',
        group: 'Cohérence métier',
        status: diff === 0 ? 'pass' : 'fail',
        message: diff === 0
          ? `Total cohérent : ${totalItems} items`
          : `Incohérence : total=${totalItems}, somme par espace=${sumCount}`,
        count: diff,
        durationMs: 0,
      };
    };

    const bizNoCircularParents: TestFn = async () => {
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE chain AS (
          SELECT id, "parentId", 1 as depth FROM items WHERE "parentId" IS NOT NULL
          UNION ALL
          SELECT c.id, i."parentId", c.depth + 1
          FROM chain c
          JOIN items i ON c."parentId" = i.id
          WHERE i."parentId" IS NOT NULL AND c.depth < 50
        )
        SELECT DISTINCT id FROM chain WHERE depth >= 50
      `;
      const count = result.length;
      return {
        key: 'biz-no-circular-parents',
        label: 'Pas de boucle parent-enfant (depth < 50)',
        group: 'Cohérence métier',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0 ? 'Aucune boucle détectée' : `${count} items dans des boucles de parenté`,
        count,
        durationMs: 0,
      };
    };

    const bizPersonalSpacesSingleMember: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM spaces s
        WHERE s.type = 'PERSONAL'
          AND (SELECT COUNT(*) FROM space_memberships sm WHERE sm."spaceId" = s.id) > 1
      `;
      const count = toNum(result);
      return {
        key: 'biz-personal-spaces-single-member',
        label: 'Espaces PERSONAL avec plusieurs membres',
        group: 'Cohérence métier',
        status: count === 0 ? 'pass' : 'warning',
        message: count === 0 ? 'Tous les espaces personnels ont 1 seul membre' : `${count} espaces personnels avec plusieurs membres`,
        count,
        durationMs: 0,
      };
    };

    // ─── Groupe 3 : Santé API ───

    const apiHealth: TestFn = async () => {
      const response = await fastify.inject({ method: 'GET', url: '/health' });
      const body = JSON.parse(response.body);
      const ok = response.statusCode === 200 && body.status === 'ok';
      return {
        key: 'api-health',
        label: '/health répond status "ok"',
        group: 'Santé API',
        status: ok ? 'pass' : 'fail',
        message: ok ? `Status: ${body.status}, DB: ${body.database}` : `Status: ${body.status}, Code: ${response.statusCode}`,
        count: ok ? 0 : 1,
        durationMs: 0,
      };
    };

    const apiAuthResponds: TestFn = async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@test.com', password: 'test' },
      });
      const ok = response.statusCode !== 500;
      return {
        key: 'api-auth-responds',
        label: '/auth/login ne retourne pas 500',
        group: 'Santé API',
        status: ok ? 'pass' : 'fail',
        message: ok ? `Répond ${response.statusCode} (pas d'erreur serveur)` : `Erreur serveur: ${response.statusCode}`,
        count: ok ? 0 : 1,
        durationMs: 0,
      };
    };

    const apiAdminProtected: TestFn = async () => {
      const response = await fastify.inject({ method: 'GET', url: '/admin/users' });
      const ok = response.statusCode === 401;
      return {
        key: 'api-admin-protected',
        label: '/admin/users retourne 401 sans token',
        group: 'Santé API',
        status: ok ? 'pass' : 'fail',
        message: ok ? 'Correctement protégée (401)' : `Retourne ${response.statusCode} au lieu de 401`,
        count: ok ? 0 : 1,
        durationMs: 0,
      };
    };

    const apiResponseTime: TestFn = async () => {
      const start = Date.now();
      await fastify.inject({ method: 'GET', url: '/health' });
      const elapsed = Date.now() - start;
      const ok = elapsed < 2000;
      return {
        key: 'api-response-time',
        label: '/health répond en < 2000ms',
        group: 'Santé API',
        status: ok ? 'pass' : 'warning',
        message: `Temps de réponse: ${elapsed}ms`,
        count: ok ? 0 : 1,
        durationMs: 0,
      };
    };

    // ─── Groupe 4 : Contrôle d'accès ───

    const aclAdminRequiresRole: TestFn = async () => {
      const adminRoutes = ['/admin/users', '/admin/spaces', '/admin/communities', '/admin/anomalies', '/admin/referentiels'];
      let failCount = 0;
      const failedRoutes: string[] = [];

      for (const route of adminRoutes) {
        const response = await fastify.inject({ method: 'GET', url: route });
        if (response.statusCode !== 401) {
          failCount++;
          failedRoutes.push(`${route}=${response.statusCode}`);
        }
      }

      return {
        key: 'acl-admin-requires-role',
        label: 'Routes admin protégées par auth',
        group: 'Contrôle d\'accès',
        status: failCount === 0 ? 'pass' : 'fail',
        message: failCount === 0
          ? `${adminRoutes.length} routes admin protégées`
          : `${failCount} routes non protégées: ${failedRoutes.join(', ')}`,
        count: failCount,
        durationMs: 0,
      };
    };

    const aclNoSharedPersonalSpaces: TestFn = async () => {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM spaces s
        WHERE s.type = 'PERSONAL'
          AND (SELECT COUNT(*) FROM space_memberships sm WHERE sm."spaceId" = s.id) > 1
      `;
      const count = toNum(result);
      return {
        key: 'acl-no-shared-personal-spaces',
        label: 'Espaces PERSONAL sans utilisateurs multiples',
        group: 'Contrôle d\'accès',
        status: count === 0 ? 'pass' : 'warning',
        message: count === 0 ? 'Aucun espace personnel partagé' : `${count} espaces personnels avec plusieurs utilisateurs`,
        count,
        durationMs: 0,
      };
    };

    const aclCommunityMembershipsValid: TestFn = async () => {
      const [invalidUsers, invalidCommunities] = await Promise.all([
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM community_memberships cm
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cm."userId")
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count FROM community_memberships cm
          WHERE NOT EXISTS (SELECT 1 FROM communities c WHERE c.id = cm."communityId")
        `,
      ]);
      const count = toNum(invalidUsers) + toNum(invalidCommunities);
      return {
        key: 'acl-community-memberships-valid',
        label: 'Memberships communauté valides',
        group: 'Contrôle d\'accès',
        status: count === 0 ? 'pass' : 'fail',
        message: count === 0
          ? 'Toutes les memberships communauté sont valides'
          : `${toNum(invalidUsers)} users invalides, ${toNum(invalidCommunities)} communautés invalides`,
        count,
        durationMs: 0,
      };
    };

    // ─── Exécution de tous les tests ───

    const allTests: TestFn[] = [
      // Groupe 1: Intégrité BD
      dbFkItemsSpaces,
      dbFkContributionsItems,
      dbFkContributionsAuthors,
      dbFkMembershipsUsers,
      dbFkMembershipsSpaces,
      dbUniqueEmails,
      dbUniqueTags,
      dbRequiredFields,
      // Groupe 2: Cohérence métier
      bizUsersPersonalSpace,
      bizSpacesHaveOwner,
      bizGroupSpacesCommunity,
      bizItemCountsMatch,
      bizNoCircularParents,
      bizPersonalSpacesSingleMember,
      // Groupe 3: Santé API
      apiHealth,
      apiAuthResponds,
      apiAdminProtected,
      apiResponseTime,
      // Groupe 4: Contrôle d'accès
      aclAdminRequiresRole,
      aclNoSharedPersonalSpaces,
      aclCommunityMembershipsValid,
    ];

    const tests = await Promise.all(allTests.map(runTest));

    const summary = {
      total: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      warnings: tests.filter(t => t.status === 'warning').length,
    };

    return {
      tests,
      summary,
      totalDurationMs: Date.now() - startAll,
      executedAt: new Date().toISOString(),
    };
  });
};

/**
 * Rattrapage unique (2026-10-12) à l'introduction de l'accès MCP accordé par l'admin : accorde l'accès aux
 * utilisateurs non admin qui ont déjà un jeton personnel actif, pour ne pas couper leur Claude au déploiement.
 * Sans --apply : liste seulement. --prod : base de prod (via _env.ts), à lancer APRÈS le déploiement du schéma.
 * Exécuter : npx tsx apps/api/scripts/backfill-mcp-access.ts [--prod] [--apply]
 */
import { prodPrisma, localPrisma, isProd } from './_env';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    where: {
      globalRole: { not: 'ADMIN' },
      mcpAccessGrantedAt: null,
      personalAccessTokens: { some: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
    },
    select: { id: true, name: true, email: true },
  });
  console.log(`[${isProd ? 'PROD' : 'local'}] ${users.length} utilisateur(s) avec jeton actif sans accès MCP :`);
  for (const u of users) console.log(`  - ${u.name} <${u.email}>`);
  if (!apply || users.length === 0) return;
  const res = await prisma.user.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { mcpAccessGrantedAt: new Date(), mcpAccessRequestedAt: null },
  });
  console.log(`Accès accordé à ${res.count} utilisateur(s).`);
}

main().finally(() => prisma.$disconnect());

/*
 * Check santé SPOK — vérifie en une passe : API locale, DB locale, DB prod, R2.
 * À lancer après toute modification d'infra, rotation de credentials, ou changement de config
 * (cf. skill spok-tnr, section "Check santé post-modification").
 * Usage : cd C:/_dev/spok && npx tsx apps/api/scripts/health-check.ts
 * Lit les secrets depuis le .env racine via _env.ts — ne JAMAIS mettre de secret en dur ici (repo public).
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { ENV, prodPrisma, localPrisma } from './_env';

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: 'API locale (:3001)',
    run: async () => {
      const r = await fetch(`${ENV.LOCAL_API}/health`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return 'répond';
    },
  },
  {
    name: 'Web local (:3000)',
    run: async () => {
      const r = await fetch('http://localhost:3000');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return 'répond';
    },
  },
  {
    name: 'DB locale (5433)',
    run: async () => {
      const p = localPrisma();
      try {
        const n = await p.user.count();
        return `${n} user(s)`;
      } finally { await p.$disconnect(); }
    },
  },
  {
    name: 'DB prod (Railway)',
    run: async () => {
      const p = prodPrisma();
      try {
        const n = await p.user.count();
        return `${n} user(s)`;
      } finally { await p.$disconnect(); }
    },
  },
  {
    name: 'R2 (bucket spok-images)',
    run: async () => {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: ENV.R2_ACCESS_KEY_ID, secretAccessKey: ENV.R2_SECRET_ACCESS_KEY },
      });
      const r = await s3.send(new ListObjectsV2Command({ Bucket: ENV.R2_BUCKET, MaxKeys: 1 }));
      return `accès OK (${r.KeyCount} objet listé)`;
    },
  },
];

let failed = 0;
for (const c of checks) {
  try {
    const detail = await c.run();
    console.log(`✅ ${c.name} — ${detail}`);
  } catch (e: any) {
    failed++;
    console.log(`❌ ${c.name} — ${e.message}`);
  }
}
console.log(failed === 0 ? '\n✅ Tous les checks passent.' : `\n❌ ${failed} check(s) en échec.`);
process.exit(failed === 0 ? 0 : 1);

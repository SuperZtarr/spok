# SPOK — Configuration complète

## Git

- **Repo** : `https://github.com/SuperZtarr/spok.git`
- **Branche principale** : `master`
- **Deploy auto** : push sur `master` déclenche Railway

## Dev local

### PostgreSQL (Docker)
- **Conteneur** : `spok-postgres-dev`
- **Image** : `postgres:16-alpine`
- **Port** : `25432` (host) → `5432` (conteneur)
- **User** : `spok`
- **Password** : `spok`
- **Database** : `spok`
- **DATABASE_URL** : `postgresql://spok:spok@localhost:25432/spok?schema=public`

### API (Fastify)
- **Port** : `3001`
- **Host** : `0.0.0.0`
- **CORS** : `http://localhost:3000`

### Web (Vite)
- **Port** : `3000` (strictPort)
- **Proxy** : `/api/*` → `http://localhost:3001`
- **VITE_API_URL** : `http://localhost:3001`

### Commandes
```bash
pnpm dev:start    # PostgreSQL Docker + API + Web
pnpm dev:stop     # Arrête les processus node
pnpm dev          # API + Web (PostgreSQL déjà up)
pnpm db:up        # PostgreSQL Docker seul
pnpm db:studio    # Prisma Studio (GUI)
```

## Production (Railway)

### Domaine
- **URL** : `https://spok.space`
- **Registrar** : Namecheap
- **DNS** : pointent vers Railway (CNAME configuré chez Namecheap)
- **SSL** : géré par Railway (auto Let's Encrypt)

### Service Web
- **Dockerfile** : `docker/Dockerfile.web`
- **Runtime** : nginx (port 80)
- **Build arg** : `VITE_API_URL` (configuré dans Railway)

### Service API
- **Dockerfile** : `docker/Dockerfile.api`
- **Runtime** : Node.js (port 3001)
- **Script démarrage** : `docker/start-api.sh` (migrations Prisma + start)

### PostgreSQL (Railway managed)
- **DATABASE_URL** : `postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway`

### Variables d'environnement (Railway)
```
DATABASE_URL=postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway
API_PORT=3001
API_HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=<configuré dans Railway>
JWT_REFRESH_SECRET=<configuré dans Railway>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://spok.space
FRONTEND_URL=https://spok.space
```

## Email (Resend)

- **Service** : [Resend](https://resend.com)
- **Domaine** : `spok.space` (SPF/DKIM/DMARC configurés)
- **API Key** : `re_dKFSXpHy_Ky1pF7CgRr7v9wh9ohstSomQ`
- **EMAIL_FROM** : `SPOK <noreply@spok.space>` (prod) / `SPOK <noreply@resend.dev>` (dev)

## Stockage images (Cloudflare R2)

- **Service** : Cloudflare R2 (S3-compatible)
- **Account ID** : `a1017ff43a1c768ad17e5868c71f29af`
- **Access Key ID** : `f2de34370a2adaa9534b0ed72c2a7523`
- **Secret Access Key** : `eec8dab88ebafa2da455fa174377108a7146cea59919484baa74bf92765aee89`
- **Bucket** : `spok-images`
- **URL publique** : `https://pub-bace6d857e1249a1bd472b9a1924e91b.r2.dev`

## JWT

- **Access token** : expire en 15 minutes
- **Refresh token** : expire en 7 jours
- **Secrets** : configurés dans Railway pour la prod, valeurs par défaut en dev

## Utilisateurs clés

### Dev local
- **Admin** : `admin@spok.app` / `admin1234` (globalRole: ADMIN)

### Production
- **ztarr** : `superztarr@gmail.com` (id: `cml3q8k60000012gz2ev4dz7r`)
- **Communauté Thomas Projets** : `cmlnwrtg80001mjpp4dc1fnxq`
- **Espace doc SPOK** : `cmlzmzrfy00003frbx5q365rn`
- **Communauté Documentations** : `cmmtheuzn0005f03nqjf8p238`

---

## Procédures

### Démarrer le dev

```bash
pnpm dev:start                    # Démarre PostgreSQL Docker + API + Web
# Si les ports 3000/3001 sont occupés :
pnpm dev:stop                     # Tue les processus node SPOK
pnpm dev:start                    # Relance
```

### Après modification du schema Prisma

```bash
pnpm db:push                      # Push le schema vers la DB locale (fait aussi generate)
# En prod, le start-api.sh fait automatiquement prisma db push au démarrage
```

### Écrire des données en DB (dev ou prod)

Toujours via **Prisma Client direct** dans un script tsx. Pas besoin du serveur local.

```typescript
// apps/api/scripts/mon-script.ts
import { PrismaClient } from '@spok/database';

// Dev local :
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } },
});

// Prod :
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});
```

Exécuter :
```bash
cd C:/_dev/spok && npx tsx apps/api/scripts/mon-script.ts
```

### Synchroniser la doc SPOK vers la prod

Script existant : `apps/api/scripts/export-doc-to-prod.ts`
- Lit la communauté "Documentations" en local et l'upsert en prod
- Idempotent (peut être relancé)

```bash
npx tsx apps/api/scripts/export-doc-to-prod.ts
```

### Tester l'API locale (curl)

```bash
# Récupérer un token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spok.app","password":"admin1234"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['tokens']['accessToken'])")

# Appeler une route
curl -s http://localhost:3001/spaces \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Pièges** :
- `Content-Type: application/json; charset=utf-8` pour les accents
- `--data-raw` plutôt que `-d` pour les caractères spéciaux

### Déployer en production

```bash
git push origin master            # Railway déploie automatiquement (Web + API)
```

Si le build Railway échoue ("couldn't locate the dockerfile") :
→ Vérifier dans Railway Dashboard → service → Settings → Build → **Dockerfile Path** :
- API : `docker/Dockerfile.api`
- Web : `docker/Dockerfile.web`

Pour forcer un rebuild sans cache : bouton **Redeploy** dans le dashboard Railway.

### Pousser le schema Prisma en prod manuellement

```bash
DATABASE_URL="postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway" \
  npx prisma db push --schema packages/database/prisma/schema.prisma
```

### Libérer les ports SPOK (si bloqués)

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

**Attention** : vérifier que les PID appartiennent à SPOK et pas à un autre projet (bank tourne sur le port 3002).

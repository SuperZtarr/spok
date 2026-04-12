---
name: spok-api
description: Interagir avec l'API SPOK en local ou en prod. Utiliser pour toute opération CRUD sur des items, espaces, communautés via l'API REST SPOK. Déclencher quand on doit créer, lire, modifier ou supprimer des données dans SPOK par script.
---

# spok-api — Interactions avec SPOK

## Priorité : MCP d'abord

Pour les opérations courantes (lecture, création), utiliser les outils MCP directement :

| Opération | Outil MCP |
|-----------|-----------|
| Lister les espaces | `mcp__spok__list_spaces` |
| Lire un espace + items | `mcp__spok__get_space` |
| Rechercher des items | `mcp__spok__search_items` |
| Créer un item | `mcp__spok__create_item` |

Le MCP gère l'auth automatiquement (login + retry 401). Pas de token à gérer.

## Scripts Python — quand le MCP ne suffit pas

Pour les opérations non couvertes par le MCP (PATCH, DELETE, imports en masse, sync prod→dev) :

**Toujours écrire dans un fichier** (`scripts/tmp_spok.py`), jamais inline en bash — les apostrophes du français cassent le quoting shell.

```python
import subprocess, json

def api(token, method, path, data=None, base="http://localhost:3001"):
    args = ['curl', '-s', '-X', method,
            '-H', f'Authorization: Bearer {token}',
            '-H', 'Content-Type: application/json',
            f'{base}{path}']
    if data:
        args += ['-d', json.dumps(data)]
    r = subprocess.run(args, capture_output=True, text=True, timeout=30)
    return json.loads(r.stdout)

def login(email='admin@spok.app', password='admin1234', base='http://localhost:3001'):
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST',
         '-H', 'Content-Type: application/json',
         '-d', json.dumps({'email': email, 'password': password}),
         f'{base}/auth/login'],
        capture_output=True, text=True, timeout=30
    )
    return json.loads(r.stdout)['tokens']['accessToken']
```

## Routes REST (pour scripts uniquement)

| Opération | Route |
|-----------|-------|
| Login | `POST /auth/login` |
| Lister espaces | `GET /spaces` |
| Lister items | `GET /spaces/:spaceId/items` → `data['data']` |
| Créer item | `POST /spaces/:spaceId/items` |
| Modifier item | `PATCH /spaces/:spaceId/items/:itemId` |
| Supprimer item | `DELETE /spaces/:spaceId/items/:itemId` |

**Route inexistante** : `PATCH /items/:id` — toujours inclure le spaceId.

## Credentials

| Env | URL | Email | Password |
|-----|-----|-------|----------|
| Local | `http://localhost:3001` | `admin@spok.app` | `admin1234` |
| Prod | `https://api.spok.space` | `superztarr@gmail.com` | `1234azerQSDFwxcv` |

## Accès Prisma direct (sans serveur)

Pour les scripts de sync ou migration :

```typescript
// apps/api/scripts/mon-script.ts
import { PrismaClient } from '@spok/database';

const dev = new PrismaClient({
  datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } },
});
const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});

// Exécuter : cd C:/_dev/spok && npx tsx apps/api/scripts/mon-script.ts
```

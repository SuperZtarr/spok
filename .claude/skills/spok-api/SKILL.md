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

**Règle critique — lire puis agir dans le même script** : ne jamais analyser des IDs dans le contexte Claude pour les utiliser ensuite. Toujours écrire un script qui récupère les données via API, effectue la logique de sélection, puis applique les modifications — tout en une seule passe. Cela évite de brûler des tokens en raisonnement intermédiaire et garantit des IDs exacts.

```python
# Bon exemple : récupère les items, filtre par titre, PATCH en une passe
items = api(token, 'GET', f'/spaces/{space_id}/items?pageSize=200')['data']
for item in items:
    if 'typecheck' in item['title'].lower():
        api(token, 'PATCH', f'/spaces/{space_id}/items/{item["id"]}', {'status': 'done'})
```

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

**JAMAIS de secret en dur dans un fichier tracké** — ce repo est public (fuite corrigée le 2026-07-11, tout a été roté).

| Env | URL | Où sont les credentials |
|-----|-----|------------------------|
| Local | `http://localhost:3001` | `admin@spok.app` / `admin1234` (compte de dev, non secret) |
| Prod | `https://api.spok.space` | `.env` racine (gitignoré) : `SPOK_EMAIL`, `SPOK_PASSWORD` |

Rappel CLAUDE.md : ne jamais appeler `api.spok.space` directement — les opérations prod passent par le MCP ou par Prisma direct (ci-dessous) sur demande explicite.

## Accès Prisma direct (sans serveur)

Pour les scripts de sync ou migration, utiliser le helper `_env.ts` qui charge le `.env` racine (`PROD_DATABASE_URL`, `DATABASE_URL`) :

```typescript
// apps/api/scripts/mon-script.ts
import { prodPrisma, localPrisma, ENV } from './_env';

const dev = localPrisma();    // postgresql://spok:spok@localhost:5433/spok
const prod = prodPrisma();    // lit PROD_DATABASE_URL depuis .env

// Exécuter : cd C:/_dev/spok && npx tsx apps/api/scripts/mon-script.ts
```

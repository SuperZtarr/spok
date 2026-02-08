# API REST - SPOK

API Fastify sur le port 3001. Toutes les routes (sauf `/health` et auth) requierent un JWT.

## Authentification (`/auth`)

| Methode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/auth/register` | Inscription + creation space personnel | Non |
| POST | `/auth/login` | Connexion, retourne tokens | Non |
| POST | `/auth/refresh` | Rafraichir access token | Non |
| GET | `/auth/me` | Utilisateur courant | Oui |
| POST | `/auth/logout` | Invalider refresh token | Non |
| POST | `/auth/forgot-password` | Demande reset password (email) | Non |
| POST | `/auth/reset-password` | Reset avec token | Non |

**Tokens** : JWT access token (header `Authorization: Bearer`) + refresh token (7 jours).

### Schemas

**Register** :
```json
{ "email": "string", "password": "string(8+)", "name": "string" }
```

**Login** :
```json
{ "email": "string", "password": "string" }
```

**Reponse Auth** :
```json
{
  "user": { "id", "email", "name", "globalRole", "createdAt" },
  "tokens": { "accessToken": "string", "refreshToken": "string" }
}
```

## Utilisateur (`/user`)

| Methode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| PATCH | `/user/profile` | Modifier profil (nom, avatar) | Oui |
| PATCH | `/user/password` | Changer mot de passe | Oui |
| PATCH | `/user/theme` | Changer preference theme | Oui |

## Communautes (`/communities`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/communities` | Liste des communautes de l'utilisateur | - |
| GET | `/communities/:id` | Details d'une communaute | Member |
| PATCH | `/communities/:id` | Modifier une communaute | OWNER, ADMIN |
| GET | `/communities/:id/members` | Liste des membres | Member |
| POST | `/communities/:id/members` | Ajouter un membre | OWNER, ADMIN |
| PATCH | `/communities/:id/members/:memberId` | Modifier role | OWNER, ADMIN |
| DELETE | `/communities/:id/members/:memberId` | Retirer un membre | OWNER, ADMIN |

### Acces communautaire

Les membres d'une communaute ont acces en lecture (VIEWER) a tous les espaces de cette communaute, meme sans SpaceMembership directe. Le role `VIEWER` est injecte via la route `/spaces` quand l'utilisateur est membre de la communaute parente.

## Spaces (`/spaces`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/spaces` | Spaces de l'utilisateur (directs + communautaires) | - |
| POST | `/spaces` | Creer un space | - |
| GET | `/spaces/:id` | Details d'un space | Member ou VIEWER communautaire |
| PATCH | `/spaces/:id` | Modifier un space | OWNER, ADMIN |
| DELETE | `/spaces/:id` | Supprimer un space | OWNER |
| GET | `/spaces/:id/members` | Liste des membres | Member |
| POST | `/spaces/:id/invite` | Inviter un utilisateur | OWNER, ADMIN |

**Types de space** : `PERSONAL`, `GROUP`

**Restrictions** :
- Impossible de supprimer un space `PERSONAL`
- Invitation impossible sur space `PERSONAL`

### Schemas

**Create Space** :
```json
{ "name": "string(1+)", "type": "PERSONAL|GROUP" }
```

**Invite** :
```json
{ "email": "string", "role": "ADMIN|MEMBER|VIEWER" }
```

## Items (`/spaces/:spaceId/items`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/items` | Liste paginee | Member ou VIEWER |
| POST | `/items` | Creer un item | Not VIEWER |
| GET | `/items/:id` | Details + enfants + relations + contributions | Member ou VIEWER |
| PATCH | `/items/:id` | Modifier un item | Not VIEWER |
| DELETE | `/items/:id` | Supprimer un item | MEMBER+ |
| POST | `/items/:id/relations` | Creer une relation | Not VIEWER |
| DELETE | `/items/:id/relations/:relationId` | Supprimer une relation | Not VIEWER |
| PATCH | `/items/:id/move` | Deplacer (parent/position) | Not VIEWER |
| POST | `/items/bulk-move` | Deplacer plusieurs items vers autre space | Not VIEWER |
| POST | `/items/bulk-duplicate` | Dupliquer plusieurs items | Not VIEWER |

### Contributions (`/spaces/:spaceId/items/:itemId/contributions`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| POST | `/items/:id/contributions` | Ajouter une contribution | Not VIEWER |
| PATCH | `/items/:id/contributions/:contribId` | Modifier une contribution | Auteur uniquement |
| DELETE | `/items/:id/contributions/:contribId` | Supprimer une contribution | Auteur uniquement |

### Parametres de liste (GET)

| Parametre | Type | Description |
|-----------|------|-------------|
| `type` | enum | Filtrer par type |
| `status` | string | Filtrer par statut |
| `parentId` | string/null | Filtrer par parent |
| `search` | string | Recherche dans titre (insensible casse) |
| `page` | number | Page (defaut: 1) |
| `pageSize` | number | Taille page (defaut: 20, max: 100) |
| `orderBy` | string | Champ de tri (ex: `title`) |

### Schema Item

```json
{
  "type": "NOTE|PROJECT|TASK|MEETING|PERIOD|LINK|CONFIG|DOCUMENT|IMAGE",
  "title": "string(1+)",
  "description": "string?",
  "content": "object?",
  "url": "string(url)?",
  "status": "string?",
  "priority": "number(1-4)?",
  "dueDate": "datetime?",
  "startDate": "datetime?",
  "endDate": "datetime?",
  "parentId": "string?",
  "tagIds": "string[]?"
}
```

### Bulk Operations

**Bulk Move** :
```json
{
  "itemIds": "string[](1+)",
  "targetSpaceId": "string",
  "includeChildren": "boolean (defaut: true)"
}
```

**Bulk Duplicate** :
```json
{
  "itemIds": "string[](1+)",
  "targetSpaceId": "string",
  "includeChildren": "boolean (defaut: true)"
}
```

Fonctionnalites :
- Resolution automatique des tags (cree les tags manquants dans le space cible)
- Preserve les relations parent-enfant entre items deplaces/dupliques
- Supprime les relations partielles lors d'un move

## Recherche (`/search`)

| Methode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/search?q=terme` | Recherche cross-espaces dans les titres | Oui |

Retourne les items correspondants parmi tous les espaces accessibles par l'utilisateur (directs + communautaires).

## Tags (`/spaces/:spaceId/tags`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/tags` | Liste des tags | Member ou VIEWER |
| POST | `/tags` | Creer un tag | Not VIEWER |
| PATCH | `/tags/:id` | Modifier un tag | Not VIEWER |
| DELETE | `/tags/:id` | Supprimer un tag | OWNER, ADMIN |

### Schema

```json
{ "name": "string(1+)", "color": "#RRGGBB?" }
```

**Contraintes** : Nom unique par space, couleur au format hex.

## Referentiels (`/spaces/:spaceId/referentiels`)

Configuration des types et statuts personnalises par space.

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/referentiels` | Obtenir config | Member ou VIEWER |
| PUT | `/referentiels` | Modifier config | OWNER, ADMIN |
| POST | `/referentiels/reset` | Reinitialiser aux valeurs par defaut | OWNER, ADMIN |
| GET | `/referentiels/check-status-usage/:statusId` | Nombre d'items utilisant ce statut | Member |

### Schema

```json
{
  "statuses": [
    {
      "id": "string",
      "label": "string",
      "color": "string",
      "borderColor": "string",
      "order": "number",
      "visible": "boolean"
    }
  ],
  "typeLabels": {
    "NOTE": {
      "label": "string",
      "labelShort": "string",
      "color": "string",
      "bgHover": "string",
      "visible": "boolean",
      "order": "number"
    }
  }
}
```

## Audit Logs (`/spaces/:spaceId/audit-logs`)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/audit-logs` | Liste paginee | Member ou VIEWER |
| GET | `/audit-logs/:id` | Detail d'un log | Member ou VIEWER |
| POST | `/audit-logs/:id/restore` | Restaurer depuis log | MEMBER+ |

### Parametres de liste

| Parametre | Type | Description |
|-----------|------|-------------|
| `entity` | enum | `Item`, `ItemRelation` |
| `action` | enum | `CREATE`, `UPDATE`, `DELETE`, `MOVE`, `BULK_MOVE`, `ADD_RELATION`, `DELETE_RELATION` |
| `entityId` | string | ID de l'entite |
| `userId` | string | ID de l'utilisateur |
| `from` | datetime | Date de debut |
| `to` | datetime | Date de fin |
| `page` | number | Page |
| `pageSize` | number | Taille page |

### Restauration

| Action | Comportement |
|--------|--------------|
| `UPDATE`, `MOVE` | Restaure l'etat precedent |
| `DELETE` | Recree l'item supprime |
| `DELETE_RELATION` | Recree la relation |
| `CREATE`, `ADD_RELATION` | Erreur (utiliser delete) |
| `BULK_MOVE` | Erreur (restaurer individuellement) |

## Admin (`/admin/*`)

Requiert le role global `ADMIN` (header JWT).

### Utilisateurs (`/admin/users`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/users` | Liste paginee (`search`, `page`, `pageSize`) |
| GET | `/admin/users/:id` | Details utilisateur |
| POST | `/admin/users` | Creer utilisateur |
| PATCH | `/admin/users/:id` | Modifier utilisateur |
| DELETE | `/admin/users/:id` | Supprimer utilisateur |

**Schema Create** :
```json
{
  "email": "string",
  "password": "string(8+)",
  "name": "string",
  "globalRole": "USER|ADMIN (defaut: USER)"
}
```

**Contraintes** :
- Impossible de retrograder le dernier admin
- Impossible de supprimer le dernier admin
- Impossible de supprimer son propre compte

### Spaces Admin (`/admin/spaces`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/spaces` | Liste (`search`, `type`, `page`, `pageSize`) |
| GET | `/admin/spaces/:id` | Details space |
| PATCH | `/admin/spaces/:id` | Modifier space |
| DELETE | `/admin/spaces/:id` | Supprimer (bypass ownership) |
| GET | `/admin/spaces/:id/members` | Liste membres |
| POST | `/admin/spaces/:id/members` | Ajouter membre |
| PATCH | `/admin/spaces/:id/members/:memberId` | Modifier role |
| DELETE | `/admin/spaces/:id/members/:memberId` | Retirer membre |

**Add Member** :
```json
{ "userId": "string", "role": "OWNER|ADMIN|MEMBER|VIEWER" }
```

### Communautes Admin (`/admin/communities`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/communities` | Liste paginee |
| GET | `/admin/communities/:id` | Details communaute |
| POST | `/admin/communities` | Creer communaute |
| PATCH | `/admin/communities/:id` | Modifier communaute |
| DELETE | `/admin/communities/:id` | Supprimer communaute |

### Referentiels Admin (`/admin/referentiels`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/referentiels` | Vue globale des referentiels de tous les spaces |

### Anomalies Admin (`/admin/anomalies`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/anomalies` | 12 controles de qualite des donnees |

### Tests Admin (`/admin/tests`)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/tests` | 21 tests de non-regression |

## Health Check

| Methode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/health` | Status API + DB | Non |

**Reponse** :
```json
{
  "status": "ok|degraded",
  "database": "connected|disconnected",
  "databaseError": "string?",
  "timestamp": "ISO 8601",
  "env": "development|production"
}
```

## Roles et Permissions

### Roles Space (SpaceMembership)

| Role | Permissions |
|------|-------------|
| `OWNER` | Tout (supprimer space, gerer membres, settings) |
| `ADMIN` | Gerer items, membres, settings (pas supprimer space) |
| `MEMBER` | Creer/modifier items et relations |
| `VIEWER` | Lecture seule (acces direct ou via communaute) |

### Roles Communaute (CommunityMembership)

| Role | Permissions |
|------|-------------|
| `OWNER` | Gerer la communaute et ses membres |
| `ADMIN` | Gerer les membres |
| `MEMBER` | Acces VIEWER a tous les espaces de la communaute |

### Roles Globaux (User)

| Role | Permissions |
|------|-------------|
| `USER` | Utilisateur standard |
| `ADMIN` | Acces routes `/admin/*` |

## Format des erreurs

```json
{
  "statusCode": 400,
  "error": "Validation Error",
  "message": "Description lisible en francais",
  "code": "VALIDATION_ERROR",
  "field": "champ concerne?",
  "details": ["champ: message"]
}
```

### Codes d'erreur

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Donnees invalides |
| `UNIQUE_CONSTRAINT` | 409 | Valeur deja existante |
| `NOT_FOUND` | 404 | Ressource non trouvee |
| `FOREIGN_KEY_CONSTRAINT` | 400 | Reference invalide |
| `REQUIRED_RELATION` | 400 | Relation requise manquante |
| `ROUTE_NOT_FOUND` | 404 | Endpoint inexistant |
| `INTERNAL_ERROR` | 500 | Erreur interne |

## Structure des fichiers

```
apps/api/src/
├── index.ts                 # Point d'entree, config Fastify, error handlers
├── plugins/
│   ├── prisma.ts            # Plugin Prisma (decorateur app.prisma)
│   ├── jwt.ts               # Plugin JWT (decorateur app.jwt, authenticate)
│   └── adminAuth.ts         # Plugin verification role ADMIN
└── routes/
    ├── auth.ts              # /auth - authentification
    ├── user.ts              # /user - profil utilisateur
    ├── communities.ts       # /communities - communautes
    ├── search.ts            # /search - recherche globale
    ├── spaces.ts            # /spaces - inclut sous-routes:
    │   ├── items            #   /spaces/:id/items (+ contributions)
    │   ├── tags             #   /spaces/:id/tags
    │   ├── referentiels     #   /spaces/:id/referentiels
    │   └── audit-logs       #   /spaces/:id/audit-logs
    └── admin/
        ├── users.ts         # /admin/users
        ├── spaces.ts        # /admin/spaces
        ├── communities.ts   # /admin/communities
        ├── referentiels.ts  # /admin/referentiels
        ├── anomalies.ts     # /admin/anomalies
        └── tests.ts         # /admin/tests
```

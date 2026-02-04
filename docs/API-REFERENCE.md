# API REST - SPOK

API Fastify sur le port 3001. Toutes les routes (sauf `/health` et auth) requièrent un JWT.

## Authentification (`/auth`)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/auth/register` | Inscription + création space personnel | Non |
| POST | `/auth/login` | Connexion, retourne tokens | Non |
| POST | `/auth/refresh` | Rafraîchir access token | Non |
| GET | `/auth/me` | Utilisateur courant | Oui |
| POST | `/auth/logout` | Invalider refresh token | Non |
| POST | `/auth/forgot-password` | Demande reset password (email) | Non |
| POST | `/auth/reset-password` | Reset avec token | Non |

**Tokens** : JWT access token (header `Authorization: Bearer`) + refresh token (7 jours).

### Schémas

**Register** :
```json
{ "email": "string", "password": "string(8+)", "name": "string" }
```

**Login** :
```json
{ "email": "string", "password": "string" }
```

**Réponse Auth** :
```json
{
  "user": { "id", "email", "name", "globalRole", "createdAt" },
  "tokens": { "accessToken": "string", "refreshToken": "string" }
}
```

## Spaces (`/spaces`)

| Méthode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/spaces` | Liste des spaces de l'utilisateur | - |
| POST | `/spaces` | Créer un space | - |
| GET | `/spaces/:id` | Détails d'un space | Member |
| PATCH | `/spaces/:id` | Modifier un space | OWNER, ADMIN |
| DELETE | `/spaces/:id` | Supprimer un space | OWNER |
| GET | `/spaces/:id/members` | Liste des membres | Member |
| POST | `/spaces/:id/invite` | Inviter un utilisateur | OWNER, ADMIN |

**Types de space** : `PERSONAL`, `GROUP`

**Restrictions** :
- Impossible de supprimer un space `PERSONAL`
- Invitation impossible sur space `PERSONAL`

### Schémas

**Create Space** :
```json
{ "name": "string(1+)", "type": "PERSONAL|GROUP" }
```

**Invite** :
```json
{ "email": "string", "role": "ADMIN|MEMBER|VIEWER" }
```

## Items (`/spaces/:spaceId/items`)

| Méthode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/items` | Liste paginée | Member |
| POST | `/items` | Créer un item | Not VIEWER |
| GET | `/items/:id` | Détails + enfants + relations | Member |
| PATCH | `/items/:id` | Modifier un item | Not VIEWER |
| DELETE | `/items/:id` | Supprimer un item | MEMBER+ |
| POST | `/items/:id/relations` | Créer une relation | Not VIEWER |
| DELETE | `/items/:id/relations/:relationId` | Supprimer une relation | Not VIEWER |
| PATCH | `/items/:id/move` | Déplacer (parent/position) | Not VIEWER |
| POST | `/items/bulk-move` | Déplacer plusieurs items vers autre space | Not VIEWER |
| POST | `/items/bulk-duplicate` | Dupliquer plusieurs items | Not VIEWER |

### Paramètres de liste (GET)

| Paramètre | Type | Description |
|-----------|------|-------------|
| `type` | enum | Filtrer par type |
| `status` | string | Filtrer par statut |
| `parentId` | string/null | Filtrer par parent |
| `search` | string | Recherche dans titre (insensible casse) |
| `page` | number | Page (défaut: 1) |
| `pageSize` | number | Taille page (défaut: 20, max: 100) |

### Schéma Item

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
  "includeChildren": "boolean (défaut: true)"
}
```

**Bulk Duplicate** :
```json
{
  "itemIds": "string[](1+)",
  "targetSpaceId": "string",
  "includeChildren": "boolean (défaut: true)"
}
```

Fonctionnalités :
- Résolution automatique des tags (crée les tags manquants dans le space cible)
- Préserve les relations parent-enfant entre items déplacés/dupliqués
- Supprime les relations partielles lors d'un move

## Tags (`/spaces/:spaceId/tags`)

| Méthode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/tags` | Liste des tags | Member |
| POST | `/tags` | Créer un tag | Not VIEWER |
| PATCH | `/tags/:id` | Modifier un tag | Not VIEWER |
| DELETE | `/tags/:id` | Supprimer un tag | OWNER, ADMIN |

### Schéma

```json
{ "name": "string(1+)", "color": "#RRGGBB?" }
```

**Contraintes** : Nom unique par space, couleur au format hex.

## Référentiels (`/spaces/:spaceId/referentiels`)

Configuration des types et statuts personnalisés par space.

| Méthode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/referentiels` | Obtenir config | Member |
| PUT | `/referentiels` | Modifier config | OWNER, ADMIN |
| POST | `/referentiels/reset` | Réinitialiser aux valeurs par défaut | OWNER, ADMIN |
| GET | `/referentiels/check-status-usage/:statusId` | Nombre d'items utilisant ce statut | Member |

### Schéma

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

| Méthode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/audit-logs` | Liste paginée | Member |
| GET | `/audit-logs/:id` | Détail d'un log | Member |
| POST | `/audit-logs/:id/restore` | Restaurer depuis log | MEMBER+ |

### Paramètres de liste

| Paramètre | Type | Description |
|-----------|------|-------------|
| `entity` | enum | `Item`, `ItemRelation` |
| `action` | enum | `CREATE`, `UPDATE`, `DELETE`, `MOVE`, `BULK_MOVE`, `ADD_RELATION`, `DELETE_RELATION` |
| `entityId` | string | ID de l'entité |
| `userId` | string | ID de l'utilisateur |
| `from` | datetime | Date de début |
| `to` | datetime | Date de fin |
| `page` | number | Page |
| `pageSize` | number | Taille page |

### Restauration

| Action | Comportement |
|--------|--------------|
| `UPDATE`, `MOVE` | Restaure l'état précédent |
| `DELETE` | Recrée l'item supprimé |
| `DELETE_RELATION` | Recrée la relation |
| `CREATE`, `ADD_RELATION` | Erreur (utiliser delete) |
| `BULK_MOVE` | Erreur (restaurer individuellement) |

## Admin (`/admin/*`)

Requiert le rôle global `ADMIN` (header JWT).

### Utilisateurs (`/admin/users`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/users` | Liste paginée (`search`, `page`, `pageSize`) |
| GET | `/admin/users/:id` | Détails utilisateur |
| POST | `/admin/users` | Créer utilisateur |
| PATCH | `/admin/users/:id` | Modifier utilisateur |
| DELETE | `/admin/users/:id` | Supprimer utilisateur |

**Schéma Create** :
```json
{
  "email": "string",
  "password": "string(8+)",
  "name": "string",
  "globalRole": "USER|ADMIN (défaut: USER)"
}
```

**Contraintes** :
- Impossible de rétrograder le dernier admin
- Impossible de supprimer le dernier admin
- Impossible de supprimer son propre compte

### Spaces Admin (`/admin/spaces`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/admin/spaces` | Liste (`search`, `type`, `page`, `pageSize`) |
| GET | `/admin/spaces/:id` | Détails space |
| PATCH | `/admin/spaces/:id` | Modifier space |
| DELETE | `/admin/spaces/:id` | Supprimer (bypass ownership) |
| GET | `/admin/spaces/:id/members` | Liste membres |
| POST | `/admin/spaces/:id/members` | Ajouter membre |
| PATCH | `/admin/spaces/:id/members/:memberId` | Modifier rôle |
| DELETE | `/admin/spaces/:id/members/:memberId` | Retirer membre |

**Add Member** :
```json
{ "userId": "string", "role": "OWNER|ADMIN|MEMBER|VIEWER" }
```

## Health Check

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/health` | Status API + DB | Non |

**Réponse** :
```json
{
  "status": "ok|degraded",
  "database": "connected|disconnected",
  "databaseError": "string?",
  "timestamp": "ISO 8601",
  "env": "development|production"
}
```

## Rôles et Permissions

### Rôles Space (SpaceMembership)

| Rôle | Permissions |
|------|-------------|
| `OWNER` | Tout (supprimer space, gérer membres, settings) |
| `ADMIN` | Gérer items, membres, settings (pas supprimer space) |
| `MEMBER` | Créer/modifier items et relations |
| `VIEWER` | Lecture seule |

### Rôles Globaux (User)

| Rôle | Permissions |
|------|-------------|
| `USER` | Utilisateur standard |
| `ADMIN` | Accès routes `/admin/*` |

## Format des erreurs

```json
{
  "statusCode": 400,
  "error": "Validation Error",
  "message": "Description lisible en français",
  "code": "VALIDATION_ERROR",
  "field": "champ concerné?",
  "details": ["champ: message"]
}
```

### Codes d'erreur

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Données invalides |
| `UNIQUE_CONSTRAINT` | 409 | Valeur déjà existante |
| `NOT_FOUND` | 404 | Ressource non trouvée |
| `FOREIGN_KEY_CONSTRAINT` | 400 | Référence invalide |
| `REQUIRED_RELATION` | 400 | Relation requise manquante |
| `ROUTE_NOT_FOUND` | 404 | Endpoint inexistant |
| `INTERNAL_ERROR` | 500 | Erreur interne |

## Structure des fichiers

```
apps/api/src/
├── index.ts                 # Point d'entrée, config Fastify, error handlers
├── plugins/
│   ├── prisma.ts            # Plugin Prisma (décorateur app.prisma)
│   ├── jwt.ts               # Plugin JWT (décorateur app.jwt, authenticate)
│   └── adminAuth.ts         # Plugin vérification rôle ADMIN
└── routes/
    ├── auth.ts              # /auth - authentification
    ├── spaces.ts            # /spaces - inclut sous-routes:
    │   ├── items            #   /spaces/:id/items
    │   ├── tags             #   /spaces/:id/tags
    │   ├── referentiels     #   /spaces/:id/referentiels
    │   └── audit-logs       #   /spaces/:id/audit-logs
    └── admin/
        ├── users.ts         # /admin/users
        └── spaces.ts        # /admin/spaces
```

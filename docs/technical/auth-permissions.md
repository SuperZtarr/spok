# Auth et permissions

## Comment ca marche

Login via POST /auth/login → retourne accessToken (JWT 15min) + refreshToken (hex 7 jours en base).
Le JWT contient uniquement { userId, email } — le role n'est PAS dans le token, il est query en base a chaque requete.
Le refreshToken est a usage unique : apres validation, l'ancien est supprime et un nouveau est cree (rotation).

Cote client, fetchApi() (lib/api.ts) :
1. Verifie si le token est expire AVANT d'envoyer la requete (proactif)
2. Si expire → appelle tryRefreshToken() → utilise le nouveau token
3. Si 401 apres envoi → tente aussi un refresh puis retry
4. Si refresh echoue → clearAuth() → evenement auth:logout → redirect /login
5. Refresh proactif aussi au focus de tab (visibilitychange)

Tokens stockes en double : localStorage['accessToken'] (pour fetchApi) + localStorage['auth-storage'] (Zustand persist avec user/tokens/isAuthenticated).

## Roles

### GlobalRole (User)
- USER : utilisateur standard
- ADMIN : acces aux routes /admin/*
- Stocke dans User.globalRole (Prisma)
- Verifie par fastify.authenticateAdmin (plugins/adminAuth.ts) : jwtVerify + query globalRole en base

### Role (SpaceMembership)
- OWNER : tout faire dans l'espace (supprimer, inviter, gerer membres)
- MEMBER : creer/editer des items
- VIEWER : lecture seule (5 vues autorisees : overview, list, kanban, timeline, mindmap)
- Stocke dans SpaceMembership.role

### CommunityRole (CommunityMembership)
- OWNER : gerer la communaute et ses espaces
- MEMBER : acceder aux espaces selon leur visibilite

## Permissions par action

### API (routes/)
| Action | Qui peut |
|--------|----------|
| Voir un espace public | Tous (optionalAuthenticate) |
| Voir un espace PRIVATE | Membres de l'espace seulement |
| Creer un item | OWNER ou MEMBER de l'espace |
| Editer un item | OWNER espace, auteur de l'item, ou assigne |
| Supprimer un espace | OWNER espace ou OWNER communaute |
| Routes /admin/* | GlobalRole === ADMIN |

### Web (composants)
- ViewModeSelector : filtre les vues par allowedViews (VIEWER → 5 vues)
- ItemEditModal : badge "Lecture seule" si pas canEdit
- KanbanView : drag desactive si VIEWER
- MindMapView : nodesDraggable=false si VIEWER
- SpaceToolbar : boutons de gestion visibles seulement pour OWNER
- AdminRoute : redirect / si pas ADMIN

## Routes protegees

### Publiques (pas d'auth)
/login, /register, /forgot-password, /reset-password, /verify-email, /invitation, /sitemap, GET /spaces (filtre), GET /communities (filtre)

### Auth requise
GET /auth/me, mutations items/spaces/communities, invitations

### Admin requise
Toutes les routes /admin/* (preHandler: authenticateAdmin)

## Fichiers cles
- `apps/web/src/stores/auth.ts` — store Zustand + persist
- `apps/web/src/lib/api.ts` — fetchApi, token refresh, clearAuth
- `apps/api/src/routes/auth.ts` — login, register, refresh, logout, generateTokens
- `apps/api/src/plugins/jwt.ts` — verify, optionalAuthenticate, decorators
- `apps/api/src/plugins/adminAuth.ts` — authenticateAdmin decorator
- `apps/web/src/stores/viewMode.ts` — VIEWER_ALLOWED_VIEWS, allowedViews
- `packages/shared/src/types/auth.ts` — GlobalRole, JWTPayload, AuthUser

## Decisions d'architecture
- Role PAS dans le JWT : permet de changer un role sans regenerer de token
- Refresh token a usage unique avec rotation : limite la fenetre d'exploitation en cas de vol
- clearAuth dispatch un CustomEvent('auth:logout') ecoute dans App.tsx : decouplage entre api.ts et le store React
- fetchApi lit localStorage directement (pas le store Zustand) : evite les problemes de timing a la rehydratation

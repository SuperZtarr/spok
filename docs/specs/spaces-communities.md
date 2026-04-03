# Espaces et communautes

## Espaces (Space)

### Champs principaux
- name, type (PERSONAL | GROUP), communityId (nullable), parentId (nullable)
- avatarUrl, coverUrl, coverPosition/X/Zoom
- defaultRole (Role? : role auto-attribue aux membres de la communaute, null = pas d'auto-join)
- visibility (OPEN | READONLY | PRIVATE, nullable = herite du parent/communaute)

### Types
- PERSONAL : espace personnel, cree automatiquement a l'inscription, toujours OWNER
- GROUP : espace collaboratif, peut etre independant ou dans une communaute

### Hierarchie
- parentId : un espace peut avoir un parent (arborescence d'espaces)
- Les enfants sont affiches en arbre dans la sidebar via buildSpaceTree()
- Un espace peut etre dans une communaute (communityId) ET avoir un parent

### Visibilite
- OPEN : tous les membres communaute peuvent voir et editer
- READONLY : tous peuvent voir, seuls les membres explicites editent
- PRIVATE : seuls les membres explicites accedent

## Memberships (SpaceMembership)

- userId + spaceId (unique)
- role : OWNER, MEMBER, VIEWER
- joinedAt

Auto-join : quand un utilisateur rejoint une communaute, il est auto-ajoute aux espaces ayant defaultRole != null avec le role defini.

## Communautes (Community)

### Champs principaux
- name, description, visibility (OPEN | READONLY | PRIVATE, defaut PRIVATE)
- pendingVisibility : visibilite demandee en attente d'approbation admin
- avatarUrl, coverUrl, coverPosition/X/Zoom
- referentiels (Json) : config de referentiels

### Memberships (CommunityMembership)
- userId + communityId (unique)
- role : OWNER, MEMBER
- order : tri personnalise par l'utilisateur

## Favoris (SpaceFavorite)

- Modele : userId + spaceId (cle composite)
- API : GET /spaces/favorites, POST /spaces/:id/favorite, DELETE /spaces/:id/favorite
- Idempotent : ajouter un favori existant ne fait rien

## Sidebar (Layout.tsx)

### Construction de l'arbre

buildSpaceTree(spaces) :
1. Map tous les espaces par id
2. Pour chaque espace : si parentId existe dans la map → push dans parent.children, sinon → racine
3. Retourne les racines

### Groupement des espaces (useMemo)

3 categories :
1. **mySpaces** : type === PERSONAL, tri par nom
2. **communityGroups** : groupes par communityId, chaque groupe a un spaceTree
3. **independentSpaces** : type !== PERSONAL et pas de communityId, en arbre

### Sections sidebar (utilisateur connecte)
1. Favoris (si > 0) — icone Star
2. Recents (si > 0) — icone Clock, max 5, stockes dans localStorage['spok_recent_spaces']
3. Mes espaces (PERSONAL)
4. Communautes (chacune collapsible, avec arbre d'espaces)
5. Autres espaces (independants)

### Sections sidebar (visiteur)
- Communautes publiques seulement, pas de favoris/recents/personnels

### Etat expand/collapse
- Espaces : expandedSpaceIds (Set), localStorage['spok-expanded-spaces']
- Communautes : collapsedCommunityIds (Set, logique inversee : expandues par defaut), localStorage['spok-collapsed-communities']
- Auto-expand : naviguer vers un espace auto-expand sa communaute

### Resize sidebar
- Largeur par defaut : 208px, min 160, max 400
- Stockee dans localStorage['spok-sidebar-width']
- Handle de resize sur le bord droit (1px, visible au hover)
- Desktop seulement (mobile : sidebar en overlay plein ecran)

### Espace actif
- Detecte depuis l'URL (/spaces/:id)
- Highlight : bg-primary/10 text-primary font-medium

### SpaceTreeItem (composant recursif)
- Indentation : 12 + (level x 16)px
- Chevron toggle si enfants
- Avatar/icone + nom (tronque)
- Bouton favori au hover
- Checkbox "inclure enfants" au hover

## Fichiers cles
- `packages/database/prisma/schema.prisma` — Space, SpaceMembership, Community, CommunityMembership, SpaceFavorite
- `apps/api/src/routes/spaces.ts` — CRUD espaces, favoris, memberships
- `apps/api/src/routes/communities.ts` — CRUD communautes
- `apps/api/src/routes/invitations.ts` — invitations + autoJoinCommunitySpaces
- `apps/web/src/components/Layout.tsx` — sidebar, buildSpaceTree, CommunitySection, SpaceTreeItem

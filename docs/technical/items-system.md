# Systeme d'items

## Types d'items (ItemType enum)
NOTE, PROJECT, TASK, MEETING, PERIOD, LINK, CONFIG, DOCUMENT, IMAGE, BUG, DIAGRAM

## CRUD

### Creer (POST /spaces/:spaceId/items/)
- Champs : type, title, description, content (JSON), url, status, priority, dueDate, startDate, endDate, parentId, assignedToId, tagIds
- startDate = now() par defaut si non fourni
- Cree les ItemTag si tagIds fourni
- Notifie les @mentions dans la description
- Audit log : CREATE Item

### Lire (GET /spaces/:spaceId/items/:id)
- Includes : tags, children (avec tags), parent, createdBy, assignedTo, relationsFrom, relationsTo, contributions, reactions
- Calcule reactionSummary (count + userReacted par type)

### Modifier (PATCH /spaces/:spaceId/items/:id)
- Verrouillage optimiste : compare clientUpdatedAt vs serverUpdatedAt → 409 CONFLICT si mismatch
- Auto-set endDate = now() quand status → 'done' ou 'cancelled'
- propagateToChildren: true → propage le statut a tous les descendants recursivement
- Notifie l'assigne si changement d'assignation
- Notifie les @mentions

### Supprimer (DELETE /spaces/:spaceId/items/:id?deleteChildren=true)
- deleteChildren=true : supprime recursivement tous les descendants
- Sans deleteChildren : les enfants deviennent orphelins (parentId = null)
- Audit log par item supprime, groupes par batchId

### Lister (GET /spaces/:spaceId/items/)
- Filtres : type, status, parentId, search (titre case-insensitive), additionalSpaceIds
- Pagination : page (defaut 1), pageSize (defaut 20, max 5000)
- include=contributions pour charger les contributions

## Hierarchie parent-enfant
- Item.parentId (nullable) → reference vers un autre Item
- Self-referential relation "ItemHierarchy"
- Deplacer un item change parentId + reordonne les siblings (position)
- Protection contre les cycles : interdiction de deplacer un item vers son propre descendant (400)

## Relations (ItemRelation)
- Modele : fromItemId, toItemId, type (string libre), label (optionnel)
- Contrainte unique : (fromItemId, toItemId, type)
- Cross-space possible : verifie l'acces de l'utilisateur a l'espace cible
- Types courants : "blocks", "relates", "depends"
- Routes : POST/PATCH/DELETE /spaces/:spaceId/items/:id/relations

## Contributions (commentaires)
- Modele : content (string), itemId, authorId, parentId (threading)
- OWNER ou MEMBER requis pour creer
- Seul l'auteur ou OWNER espace peut modifier
- Notifie le createur et l'assigne de l'item
- Notifie les @mentions

## Operations en masse

### Dupliquer (POST /spaces/:spaceId/items/bulk-duplicate)
- Body : { itemIds[], targetSpaceId, includeChildren }
- Deux passes : (1) creer sans parent, (2) rattacher les parents
- Mappe les tags par nom dans l'espace cible
- Duplique les relations entre items dupliques

### Deplacer (POST /spaces/:spaceId/items/bulk-move)
- Body : { itemIds[], targetSpaceId, includeChildren }
- Collecte les descendants si includeChildren
- Mappe les tags par nom

### Fusionner (POST /spaces/:spaceId/items/:id/merge)
- Body : { targetItemId, keep: { title, type, status, ... } }
- keep.description : 'source', 'target', ou 'concat'
- Enfants, contributions, tags (union), relations transferes vers target
- Source supprime apres merge

### Convertir en espace (POST /spaces/:spaceId/items/:itemId/convert-to-space)
- Cree un nouvel espace GROUP
- Deplace l'item et ses descendants dans le nouvel espace
- Mappe les tags

## Uploads (item-uploads.ts)
- Image : JPEG/PNG/WebP/GIF, max 5 Mo, optimisation via processImage(), upload R2
- Document : PDF/Office/text/images/archives, max 25 Mo, upload R2 direct
- Met a jour item.url avec l'URL CDN
- Supprime l'ancien fichier R2 si remplacement

## Fichiers cles
- `apps/api/src/routes/items.ts` — CRUD principal
- `apps/api/src/routes/item-relations.ts` — relations
- `apps/api/src/routes/item-contributions.ts` — contributions
- `apps/api/src/routes/item-bulk.ts` — duplication en masse
- `apps/api/src/routes/item-move.ts` — deplacer + reordonner
- `apps/api/src/routes/item-merge.ts` — fusionner + absorber enfants
- `apps/api/src/routes/item-convert.ts` — convertir en espace
- `apps/api/src/routes/item-uploads.ts` — upload images/documents
- `packages/database/prisma/schema.prisma` — Item, ItemRelation, Contribution models

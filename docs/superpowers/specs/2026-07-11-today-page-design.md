# Ma journée (`/today`) — Design

**Date** : 2026-07-11
**Statut** : validé par Thomas (conversation), en attente de relecture du présent document

## Besoin

Thomas pilote plusieurs projets et ne sait plus « ce qu'il doit faire maintenant ». Les tâches vivent dans SPOK, mais les réunions vivent dans Outlook (deux comptes retenus : boîte pro client + Hotmail perso). La page Tâches globales est incomplète par construction : elle ne voit pas le calendrier.

**Réponse** : une page « Ma journée » qui fusionne les réunions des calendriers externes avec une liste du jour mi-calculée, mi-choisie (mode mixte : SPOK propose, Thomas ajuste, la sélection est persistée par date).

## Décisions structurantes

- **Ingestion calendrier par URL ICS publiée** (Outlook.com et M365 savent publier un lien privé). Pas d'OAuth Microsoft : les tenants d'entreprise le bloquent souvent, et la lecture seule suffit au pilotage.
- L'ingestion est isolée derrière une interface **`CalendarSource`** côté API pour pouvoir brancher Microsoft Graph plus tard sans toucher la page.
- La **liste du jour est un engagement persisté** (table dédiée), pas un filtre recalculé : ce que Thomas a choisi le matin reste sa liste du jour.
- L'état « fait » d'une tâche reste porté par l'item (status) — la liste du jour n'introduit pas de deuxième vérité.
- Fraîcheur des calendriers : cache serveur ~15 min. Suffisant pour du pilotage quotidien, assumé.

## Modèle de données (Prisma)

### `CalendarFeed`
| Champ | Type | Rôle |
|-------|------|------|
| id | cuid | |
| userId | FK User | propriétaire |
| name | String | « Client », « Perso »… |
| url | String | lien ICS privé — secret utilisateur, jamais logué |
| color | String | couleur d'affichage |
| enabled | Boolean | défaut true |
| lastFetchedAt | DateTime? | dernier fetch réussi |
| lastError | String? | dernier échec (affiché en badge) |

### `DayPlanEntry`
| Champ | Type | Rôle |
|-------|------|------|
| id | cuid | |
| userId | FK User | |
| date | DateTime @db.Date | le jour de l'engagement |
| itemId | FK Item (onDelete Cascade) | la tâche engagée |
| position | Int | ordre manuel |
| source | String | 'auto' (suggestion acceptée) ou 'manual' (pioche) |

Contrainte unique `(userId, date, itemId)`.

## API (Fastify)

Préfixe `/user` (convention du repo — cf. `/user/tasks`), pas `/me`.

- `GET/POST/PATCH/DELETE /user/calendar-feeds` — CRUD des abonnements, scope utilisateur courant
- `GET /user/agenda?date=YYYY-MM-DD&from=ISO&to=ISO` — `from`/`to` sont les bornes de la journée calculées par le client dans son fuseau (évite toute conversion de fuseau côté serveur) ; `date` sert de clé au plan du jour. Une seule passe :
  - `events[]` : événements ICS des feeds actifs (parsing `node-ical`, expansion RRULE, fuseau Europe/Paris) fusionnés avec les items MEETING SPOK du jour ; chaque événement tagué par source (feedId ou 'spok')
  - `plan[]` : DayPlanEntry du jour, items inclus
  - `suggestions[]` : TASK non terminées « de l'utilisateur » — c'est-à-dire assignées à lui, ou créées par lui et non assignées — triées retard → échéance du jour → in_progress → priorité haute, plafonnées à 10, moins celles déjà au plan
- `POST /user/day-plan` (date, itemId, source) / `DELETE /user/day-plan/:id` / `PATCH /user/day-plan/:id` (position)

### Gestion d'erreurs
- Feed injoignable ou ICS invalide → `lastError` renseigné, l'agenda répond quand même avec les autres sources — jamais de 500 pour un feed cassé
- URL ICS jamais présente dans les logs ni les messages d'erreur

## Frontend

- **Page `/today`** (écran d'atterrissage du matin) :
  - colonne **réunions** : timeline verticale du jour, couleur par source, heure de début/fin
  - colonne **liste du jour** : plan persisté (réordonnable), puis suggestions acceptables d'un clic, puis bouton « piocher » ouvrant le vivier de tâches (réutilise la logique de la page Tâches globales)
  - navigation par date (hier/aujourd'hui/demain), badge discret si un feed est en erreur
- **Réglages calendriers** : modale ouverte depuis la page (pas de page dédiée)
- **Menu** : l'ajout de l'entrée de navigation passe par la skill `spok-menu` (obligatoire)
- Patterns : TanStack Query selon conventions queryKey d'ARCHITECTURE.md ; pas de nouveau store Zustand sauf nécessité démontrée
- Consultation doc SPOK obligatoire avant de coder (items Pages utilisateur / Navigation globale) — si l'item de doc `/today` n'existe pas, le créer en `to_validate`

## Tests (TNR Vitest)

- Routes calendar-feeds (CRUD, scope utilisateur)
- Route agenda : fusion sources, feed en erreur non bloquant
- Algo suggestions : cas retard / échéance jour / in_progress / priorité / plafond / exclusion du plan
- Parsing ICS sur fixtures, dont événements récurrents (RRULE) et fuseaux

## Hors périmètre (acté)

- Push des MEETING SPOK vers Outlook (reste au TODO)
- OAuth Microsoft Graph (permis plus tard par `CalendarSource`)
- Vue semaine, calendriers Gmail

## Prérequis côté Thomas

Vérifier que le tenant client autorise « Publier un calendrier » (Outlook web → ⚙️ → Calendrier → Calendriers partagés). Si bloqué : secours par import manuel de fichier .ics (à ajouter au périmètre le cas échéant).

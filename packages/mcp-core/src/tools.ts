/*
 * Déclaration des outils MCP SPOK, filtrés par profil :
 *  - 'admin'       : MCP local de Thomas (stdio) — tout, y compris utilisateurs/membres/suppressions d'espaces.
 *  - 'public'      : MCP distant, jeton portée write — lecture + écriture de contenu, aucune administration.
 *  - 'public-read' : MCP distant, jeton portée read — lecture seule.
 * Toute écriture d'item passe par les conventions de l'espace (conventions.ts) ; les erreurs (ConventionError,
 * SpokApiError) sont renvoyées au modèle en isError, jamais levées. Ajouter un outil = choisir son niveau.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z, type ZodRawShape } from 'zod'
import type { SpokClient } from './client.js'
import { ConventionError, SpokApiError } from './errors.js'
import { fetchConventions, resolveStatus, resolveTags, assertTypeAllowed, assertDateOrder, type SpaceConventions } from './conventions.js'
import { normalizeDate } from './dates.js'
import { markdownToHtml } from './markdown.js'
import { extractText, formatItemLine } from './format.js'

export type ToolProfile = 'admin' | 'public' | 'public-read'
type Level = 'read' | 'write' | 'admin'

const ALLOWED: Record<ToolProfile, Level[]> = {
  admin: ['read', 'write', 'admin'],
  public: ['read', 'write'],
  'public-read': ['read'],
}

const ITEM_TYPES = ['UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const
/** Miroir de RELATION_TYPES @spok/shared hors `parent` (l'API refuse tout autre type). */
const RELATION_TYPE_VALUES = ['blocks', 'implements', 'drives', 'relates'] as const

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] })

function safe<A>(handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args)
    } catch (err) {
      if (err instanceof ConventionError) return { content: [{ type: 'text', text: `Donnée non conforme : ${err.message}` }], isError: true }
      if (err instanceof SpokApiError) return { content: [{ type: 'text', text: `Erreur SPOK ${err.status} : ${err.body}` }], isError: true }
      return { content: [{ type: 'text', text: `Erreur : ${(err as Error).message}` }], isError: true }
    }
  }
}

const asList = (data: any, ...keys: string[]): any[] => {
  if (Array.isArray(data)) return data
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k]
  return []
}

interface ItemFieldsInput {
  type?: string
  status?: string | null
  parentId?: string | null
  startDate?: string | null
  endDate?: string | null
  dueDate?: string | null
  description?: string | null
  tags?: string[]
}

/** Couleur de tag acceptée par l'API (routes/tags.ts). */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/** Champs d'item communs à create/update, validés et normalisés selon les conventions de l'espace. */
async function prepareItemFields(
  client: SpokClient,
  spaceId: string,
  input: ItemFieldsInput,
  conventionsCache: Map<string, SpaceConventions>,
): Promise<Record<string, unknown>> {
  let conv = conventionsCache.get(spaceId)
  if (!conv) {
    conv = await fetchConventions(client, spaceId)
    conventionsCache.set(spaceId, conv)
  }
  const out: Record<string, unknown> = {}
  if (input.type) {
    assertTypeAllowed(input.type, conv)
    out.type = input.type
  }
  if (input.status) out.status = resolveStatus(input.status, conv)
  else if (input.status === null) out.status = null
  for (const f of ['startDate', 'endDate', 'dueDate'] as const) {
    const v = input[f]
    if (v) out[f] = normalizeDate(v, f)
    else if (v === null) out[f] = null
  }
  assertDateOrder(out.startDate as string | undefined, out.endDate as string | undefined)
  if (input.parentId) {
    try {
      await client.get(`/spaces/${spaceId}/items/${input.parentId}`)
    } catch (err) {
      if (err instanceof SpokApiError && err.status === 404) {
        throw new ConventionError(`parentId « ${input.parentId} » introuvable dans l'espace ${spaceId}. Le parent doit appartenir au même espace.`)
      }
      throw err
    }
    out.parentId = input.parentId
  } else if (input.parentId === null) out.parentId = null
  if (input.description !== undefined && input.description !== null) out.description = markdownToHtml(input.description)
  else if (input.description === null) out.description = null
  if (input.tags !== undefined) out.tagIds = resolveTags(input.tags, conv)
  return out
}

export function registerTools(server: McpServer, client: SpokClient, profile: ToolProfile): void {
  const allowed = new Set(ALLOWED[profile])
  // Cache par connexion : les conventions d'un espace ne changent pas pendant une session MCP.
  const conventionsCache = new Map<string, SpaceConventions>()

  function define<S extends ZodRawShape>(level: Level, name: string, description: string, shape: S, handler: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<ToolResult>) {
    if (!allowed.has(level)) return
    server.tool(name, description, shape, safe(handler) as any)
  }

  // ─── Lecture ──────────────────────────────────────────────────────────────

  define('read', 'list_spaces', 'Liste les espaces SPOK accessibles. Peut filtrer par communauté.',
    { communityId: z.string().optional().describe('ID de communauté pour filtrer (optionnel)') },
    async ({ communityId }) => {
      const qs = communityId ? `?communityId=${communityId}` : ''
      const spaces = asList(await client.get(`/spaces${qs}`), 'spaces', 'data')
      const lines = spaces.map((s: any) =>
        `[${s.id}] ${s.name}${s.description ? ` — ${s.description}` : ''} | visibilité: ${s.visibility ?? '?'}${s.communityId ? ` | communauté: ${s.communityId}` : ''}${s.parentId ? ` | parent: ${s.parentId}` : ''}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucun espace accessible.')
    })

  define('read', 'get_space', 'Retourne le détail d\'un espace SPOK et ses items.',
    {
      spaceId: z.string().describe('ID de l\'espace'),
      limit: z.number().optional().default(200).describe('Nombre max d\'items à retourner (défaut 200)'),
    },
    async ({ spaceId, limit }) => {
      const [space, itemsRes] = await Promise.all([
        client.get(`/spaces/${spaceId}`),
        client.get(`/spaces/${spaceId}/items?pageSize=${limit}`),
      ])
      const items = asList(itemsRes, 'data', 'items')
      const header = [
        `# ${space.name}`,
        space.description ? `Description : ${space.description}` : null,
        `Visibilité : ${space.visibility ?? '?'}`,
        space.communityId ? `Communauté : ${space.communityId}` : null,
        space.parentId ? `Parent : ${space.parentId}` : null,
        `Items : ${items.length}`,
      ].filter(Boolean).join('\n')
      const itemLines = items.map((item: any) => formatItemLine(item, { excerpt: 200, withParent: true }))
      return ok([header, '', ...itemLines].join('\n'))
    })

  define('read', 'get_space_conventions',
    'Statuts, types et tags autorisés dans un espace. À appeler avant toute création/modification d\'item dans cet espace.',
    { spaceId: z.string().describe('ID de l\'espace') },
    async ({ spaceId }) => {
      const conv = await fetchConventions(client, spaceId)
      conventionsCache.set(spaceId, conv)
      return ok([
        `Statuts (utiliser l'id) : ${conv.statuses.map((s) => `${s.id} = ${s.label}`).join(' ; ')}`,
        `Types (utiliser l'id) : ${conv.types.map((t) => `${t.id} = ${t.label}`).join(' ; ')}`,
        `Tags existants : ${conv.tags.length ? conv.tags.map((t) => `${t.name} [${t.id}]`).join(', ') : 'aucun'}`,
      ].join('\n'))
    })

  define('read', 'search_items', 'Recherche des items dans SPOK par mot-clé. Retourne les items correspondants avec leur espace.',
    {
      q: z.string().describe('Termes de recherche'),
      limit: z.number().optional().default(20).describe('Nombre max de résultats (défaut 20)'),
    },
    async ({ q, limit }) => {
      const data = await client.get(`/search?q=${encodeURIComponent(q)}&pageSize=${limit}`)
      const items = data.items?.data ?? data.items ?? data.data ?? []
      if (items.length === 0) return ok(`Aucun résultat pour "${q}".`)
      const lines = items.map((item: any) => formatItemLine(item, { withSpace: true }))
      return ok(`${lines.length} résultat(s) pour "${q}" :\n\n${lines.join('\n')}`)
    })

  define('read', 'list_items', 'Liste les items d\'un espace SPOK avec filtres optionnels.',
    {
      spaceId: z.string().describe('ID de l\'espace'),
      type: z.string().optional().describe('Filtrer par type (NOTE, TASK, PROJECT…)'),
      status: z.string().optional().describe('Filtrer par statut (todo, in_progress, done…)'),
      parentId: z.string().optional().describe('Filtrer par parent'),
      pageSize: z.number().optional().default(100).describe('Nombre max de résultats (défaut 100)'),
      page: z.number().optional().default(1).describe('Page (défaut 1)'),
    },
    async ({ spaceId, type, status, parentId, pageSize, page }) => {
      const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) })
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      if (parentId) params.set('parentId', parentId)
      const items = asList(await client.get(`/spaces/${spaceId}/items?${params}`), 'data', 'items')
      const lines = items.map((item: any) => formatItemLine(item, { withParent: true }))
      return ok(lines.length > 0 ? `${lines.length} item(s) :\n\n${lines.join('\n')}` : 'Aucun item.')
    })

  define('read', 'get_item', 'Retourne le détail complet d\'un item SPOK (tous les champs + contenu).',
    { spaceId: z.string().describe('ID de l\'espace'), itemId: z.string().describe('ID de l\'item') },
    async ({ spaceId, itemId }) => {
      const item = await client.get(`/spaces/${spaceId}/items/${itemId}`)
      const lines = [
        `[${item.id}] [${item.type}] ${item.title}`,
        item.status ? `Statut : ${item.status}` : null,
        item.priority ? `Priorité : ${item.priority}` : null,
        item.startDate ? `Début : ${item.startDate.slice(0, 10)}` : null,
        item.endDate ? `Fin : ${item.endDate.slice(0, 10)}` : null,
        item.dueDate ? `Échéance : ${item.dueDate.slice(0, 10)}` : null,
        item.url ? `URL : ${item.url}` : null,
        item.parentId ? `Parent : ${item.parentId}` : null,
        item.spaceId ? `Espace : ${item.spaceId}` : null,
      ].filter(Boolean)
      const text = extractText(item.content ?? item.description)
      if (text) lines.push(`\nContenu :\n${text}`)
      return ok(lines.join('\n'))
    })

  define('read', 'list_communities', 'Liste les communautés SPOK accessibles.', {},
    async () => {
      const communities = asList(await client.get('/communities'), 'communities', 'data')
      const lines = communities.map((c: any) =>
        `[${c.id}] ${c.name}${c.description ? ` — ${c.description}` : ''}${c.isPublic ? ' (publique)' : ''}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucune communauté.')
    })

  define('read', 'get_community', 'Retourne le détail d\'une communauté SPOK et ses espaces.',
    { communityId: z.string().describe('ID de la communauté') },
    async ({ communityId }) => {
      const [community, spacesData] = await Promise.all([
        client.get(`/communities/${communityId}`),
        client.get(`/spaces?communityId=${communityId}`),
      ])
      const spaces = asList(spacesData, 'spaces', 'data')
      const lines = [
        `# ${community.name}`,
        community.description ? `Description : ${community.description}` : null,
        `Visibilité : ${community.isPublic ? 'Publique' : 'Privée'}`,
        `Espaces (${spaces.length}) :`,
        ...spaces.map((s: any) => `  [${s.id}] ${s.name} | visibilité: ${s.visibility ?? '?'}${s.parentId ? ` | parent: ${s.parentId}` : ''}`),
      ].filter(Boolean)
      return ok(lines.join('\n'))
    })

  define('read', 'list_relations', 'Liste les relations d\'un item.',
    { spaceId: z.string(), itemId: z.string() },
    async ({ spaceId, itemId }) => {
      const relations = asList(await client.get(`/spaces/${spaceId}/items/${itemId}/relations`), 'data')
      const lines = relations.map((r: any) =>
        `[${r.id}] ${r.type}${r.label ? ` (${r.label})` : ''} → [${r.toItemId ?? r.toItem?.id}] ${r.toItem?.title ?? ''}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucune relation.')
    })

  define('read', 'list_contributions', 'Liste les contributions (commentaires) d\'un item.',
    { spaceId: z.string(), itemId: z.string() },
    async ({ spaceId, itemId }) => {
      const contributions = asList(await client.get(`/spaces/${spaceId}/items/${itemId}/contributions`), 'data')
      const lines = contributions.map((c: any) =>
        `[${c.id}] ${c.author?.name ?? '?'} (${c.createdAt?.slice(0, 10) ?? ''}) :\n${extractText(c.content)}`)
      return ok(lines.length > 0 ? lines.join('\n\n') : 'Aucune contribution.')
    })

  define('read', 'get_contribution', 'Retourne le détail d\'une contribution.',
    { spaceId: z.string(), itemId: z.string(), contributionId: z.string() },
    async ({ spaceId, itemId, contributionId }) => {
      const contributions = asList(await client.get(`/spaces/${spaceId}/items/${itemId}/contributions`), 'data')
      const c = contributions.find((x: any) => x.id === contributionId)
      if (!c) return ok('Contribution non trouvée.')
      return ok(`[${c.id}] ${c.author?.name ?? '?'}\n${extractText(c.content)}`)
    })

  define('read', 'list_tags', 'Liste les tags utilisables dans un espace (tags de l\'espace + tags de sa communauté).',
    { spaceId: z.string().describe('ID de l\'espace') },
    async ({ spaceId }) => {
      const tags = asList(await client.get(`/spaces/${spaceId}/tags`), 'data')
      const lines = tags.map((t: any) =>
        `[${t.id}] ${t.name}${t.color ? ` (${t.color})` : ''} | ${t.isCommunityTag ? 'communauté' : 'espace'}${typeof t.itemCount === 'number' ? ` | ${t.itemCount} item(s)` : ''}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucun tag.')
    })

  define('read', 'list_notifications', 'Liste les notifications de l\'utilisateur connecté.',
    { unreadOnly: z.boolean().optional().default(false) },
    async ({ unreadOnly }) => {
      const qs = unreadOnly ? '?unreadOnly=true' : ''
      const notifs = asList(await client.get(`/notifications${qs}`), 'data')
      const lines = notifs.map((n: any) =>
        `[${n.id}] ${n.read ? '✓' : '●'} ${n.type} — ${n.message ?? ''} (${n.createdAt?.slice(0, 10) ?? ''})`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucune notification.')
    })

  // ─── Écriture ─────────────────────────────────────────────────────────────

  define('write', 'create_item',
    'Crée un item dans un espace. Statut et type doivent appartenir aux conventions de l\'espace (get_space_conventions). Description en Markdown.',
    {
      spaceId: z.string().describe('ID de l\'espace cible'),
      type: z.enum(ITEM_TYPES).describe('Type d\'item (id renvoyé par get_space_conventions)'),
      title: z.string().min(1).describe('Titre court'),
      description: z.string().optional().describe('Description en Markdown'),
      status: z.string().optional().describe('Id (ou libellé) d\'un statut de l\'espace'),
      priority: z.number().int().min(1).max(4).optional().describe('1 basse … 4 critique'),
      parentId: z.string().optional().describe('ID d\'un item parent du même espace'),
      startDate: z.string().optional().describe('AAAA-MM-JJ ou ISO 8601'),
      endDate: z.string().optional().describe('AAAA-MM-JJ ou ISO 8601, ≥ startDate'),
      dueDate: z.string().optional().describe('Échéance, AAAA-MM-JJ ou ISO 8601'),
      url: z.string().url().optional().describe('URL (obligatoire pour LINK)'),
      tags: z.array(z.string()).optional().describe('Tags existants de l\'espace (noms ou ids, cf. get_space_conventions)'),
    },
    async ({ spaceId, title, priority, url, ...rest }) => {
      if (rest.type === 'LINK' && !url) throw new ConventionError('Un item LINK exige une url.')
      const body: Record<string, unknown> = { title, ...(await prepareItemFields(client, spaceId, rest, conventionsCache)) }
      if (priority) body.priority = priority
      if (url) body.url = url
      const item = await client.post(`/spaces/${spaceId}/items`, body)
      return ok(`Item créé : [${item.id}] [${item.type}] ${item.title}`)
    })

  define('write', 'update_item',
    'Met à jour un item. Mêmes règles que create_item ; null efface un champ.',
    {
      spaceId: z.string(),
      itemId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional().describe('Markdown ; null efface'),
      status: z.string().nullable().optional(),
      priority: z.number().int().min(1).max(4).nullable().optional(),
      type: z.enum(ITEM_TYPES).optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      url: z.string().url().nullable().optional(),
      parentId: z.string().nullable().optional().describe('null = racine'),
      tags: z.array(z.string()).optional().describe('REMPLACE la liste complète des tags de l\'item (noms ou ids existants) ; [] = aucun tag'),
    },
    async ({ spaceId, itemId, title, priority, url, ...rest }) => {
      const body: Record<string, unknown> = await prepareItemFields(client, spaceId, rest, conventionsCache)
      if (title !== undefined) body.title = title
      if (priority !== undefined) body.priority = priority
      if (url !== undefined) body.url = url
      const item = await client.patch(`/spaces/${spaceId}/items/${itemId}`, body)
      return ok(`Item mis à jour : [${item.id}] ${item.title}`)
    })

  define('write', 'delete_item', 'Supprime un item SPOK. Ne jamais l\'appeler sans confirmation explicite de l\'utilisateur.',
    {
      spaceId: z.string().describe('ID de l\'espace'),
      itemId: z.string().describe('ID de l\'item'),
      deleteChildren: z.boolean().optional().default(false).describe('Supprimer aussi les enfants (défaut false)'),
    },
    async ({ spaceId, itemId, deleteChildren }) => {
      const qs = deleteChildren ? '?deleteChildren=true' : ''
      await client.delete(`/spaces/${spaceId}/items/${itemId}${qs}`)
      return ok(`Item ${itemId} supprimé.`)
    })

  define('write', 'create_space', 'Crée un espace SPOK dans une communauté.',
    {
      name: z.string().describe('Nom de l\'espace'),
      communityId: z.string().describe('ID de la communauté parente'),
      parentId: z.string().optional().describe('ID de l\'espace parent (pour sous-espace)'),
      description: z.string().optional().describe('Description de l\'espace'),
      visibility: z.enum(['PRIVATE', 'OPEN', 'READONLY']).optional().default('PRIVATE').describe('Visibilité'),
    },
    async ({ name, communityId, parentId, description, visibility }) => {
      // `type` est obligatoire côté API (400 sans lui) ; un espace de communauté est toujours GROUP.
      const body: Record<string, unknown> = { name, communityId, type: 'GROUP' }
      if (parentId) body.parentId = parentId
      if (description) body.description = description
      const space = await client.post('/spaces', body)
      // POST /spaces ignore `visibility` (absent de son schéma) : sans ce PATCH, l'espace naît en
      // visibilité nulle = héritée, même si PRIVATE était demandé.
      await client.patch(`/spaces/${space.id}`, { visibility })
      return ok(`Espace créé : [${space.id}] ${space.name} | visibilité: ${visibility}`)
    })

  define('write', 'create_relation', 'Crée une relation entre deux items.',
    {
      spaceId: z.string(),
      itemId: z.string().describe('Item source'),
      toItemId: z.string().describe('Item cible'),
      type: z.enum(RELATION_TYPE_VALUES).describe('Type de relation : blocks (bloque), implements (permet), drives (entraîne — décale les dates), relates (lié à)'),
      label: z.string().optional(),
    },
    async ({ spaceId, itemId, toItemId, type, label }) => {
      const body: Record<string, unknown> = { toItemId, type }
      if (label) body.label = label
      const r = await client.post(`/spaces/${spaceId}/items/${itemId}/relations`, body)
      return ok(`Relation créée : [${r.id}] ${type}`)
    })

  define('write', 'update_relation', 'Met à jour le type ou le label d\'une relation.',
    {
      spaceId: z.string(),
      itemId: z.string(),
      relationId: z.string(),
      type: z.enum(RELATION_TYPE_VALUES).optional(),
      label: z.string().nullable().optional(),
    },
    async ({ spaceId, itemId, relationId, ...fields }) => {
      const r = await client.patch(`/spaces/${spaceId}/items/${itemId}/relations/${relationId}`, fields)
      return ok(`Relation mise à jour : [${r.id}]`)
    })

  define('write', 'delete_relation', 'Supprime une relation entre items.',
    { spaceId: z.string(), itemId: z.string(), relationId: z.string() },
    async ({ spaceId, itemId, relationId }) => {
      await client.delete(`/spaces/${spaceId}/items/${itemId}/relations/${relationId}`)
      return ok(`Relation ${relationId} supprimée.`)
    })

  define('write', 'create_contribution',
    'Ajoute une contribution (commentaire) à un item. Contenu en Markdown.',
    { spaceId: z.string(), itemId: z.string(), content: z.string().min(1).describe('Markdown') },
    async ({ spaceId, itemId, content }) => {
      const c = await client.post(`/spaces/${spaceId}/items/${itemId}/contributions`, { content: markdownToHtml(content) })
      return ok(`Contribution créée : [${c.id}]`)
    })

  define('write', 'update_contribution',
    'Met à jour une contribution. Contenu en Markdown.',
    { spaceId: z.string(), itemId: z.string(), contributionId: z.string(), content: z.string().min(1) },
    async ({ spaceId, itemId, contributionId, content }) => {
      const c = await client.patch(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`, { content: markdownToHtml(content) })
      return ok(`Contribution mise à jour : [${c.id}]`)
    })

  define('write', 'mark_notification_read', 'Marque une notification comme lue (ou toutes si notificationId omis).',
    { notificationId: z.string().optional().describe('ID de la notification, ou omis pour tout marquer lu') },
    async ({ notificationId }) => {
      if (notificationId) {
        await client.patch(`/notifications/${notificationId}`, { read: true })
        return ok(`Notification ${notificationId} marquée lue.`)
      }
      await client.patch('/notifications/read-all', {})
      return ok('Toutes les notifications marquées lues.')
    })

  // ─── Administration (profil admin uniquement) ─────────────────────────────

  define('admin', 'update_space', 'Met à jour un espace SPOK (nom, description, visibilité).',
    {
      spaceId: z.string().describe('ID de l\'espace'),
      name: z.string().optional().describe('Nouveau nom'),
      description: z.string().optional().describe('Nouvelle description'),
      visibility: z.enum(['PRIVATE', 'OPEN', 'READONLY']).optional().describe('Nouvelle visibilité'),
    },
    async ({ spaceId, ...fields }) => {
      const space = await client.patch(`/spaces/${spaceId}`, fields)
      return ok(`Espace mis à jour : [${space.id}] ${space.name}`)
    })

  define('admin', 'delete_space', 'Supprime un espace SPOK.',
    { spaceId: z.string().describe('ID de l\'espace') },
    async ({ spaceId }) => {
      await client.delete(`/spaces/${spaceId}`)
      return ok(`Espace ${spaceId} supprimé.`)
    })

  define('admin', 'create_community', 'Crée une communauté SPOK.',
    {
      name: z.string().describe('Nom de la communauté'),
      description: z.string().optional().describe('Description'),
      isPublic: z.boolean().optional().default(false).describe('Communauté publique (défaut false)'),
    },
    async ({ name, description, isPublic }) => {
      const body: Record<string, unknown> = { name, isPublic }
      if (description) body.description = description
      const community = await client.post('/communities', body)
      return ok(`Communauté créée : [${community.id}] ${community.name}`)
    })

  define('admin', 'update_community', 'Met à jour une communauté SPOK (nom, description, visibilité).',
    {
      communityId: z.string().describe('ID de la communauté'),
      name: z.string().optional().describe('Nouveau nom'),
      description: z.string().optional().describe('Nouvelle description'),
      isPublic: z.boolean().optional().describe('Rendre publique ou privée'),
    },
    async ({ communityId, ...fields }) => {
      const community = await client.patch(`/communities/${communityId}`, fields)
      return ok(`Communauté mise à jour : [${community.id}] ${community.name}`)
    })

  define('admin', 'delete_community', 'Supprime une communauté SPOK.',
    { communityId: z.string().describe('ID de la communauté') },
    async ({ communityId }) => {
      await client.delete(`/communities/${communityId}`)
      return ok(`Communauté ${communityId} supprimée.`)
    })

  define('admin', 'list_users', 'Liste les utilisateurs SPOK.',
    {
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
      search: z.string().optional().describe('Recherche par nom ou email'),
    },
    async ({ page, pageSize, search }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      const users = asList(await client.get(`/admin/users?${params}`), 'data', 'users')
      const lines = users.map((u: any) =>
        `[${u.id}] ${u.name} <${u.email}> | rôle: ${u.globalRole ?? 'USER'}${u.isActive === false ? ' | DÉSACTIVÉ' : ''}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucun utilisateur.')
    })

  define('admin', 'get_user', 'Retourne le détail d\'un utilisateur SPOK.',
    { userId: z.string() },
    async ({ userId }) => {
      const u = await client.get(`/admin/users/${userId}`)
      const lines = [
        `[${u.id}] ${u.name} <${u.email}>`,
        `Rôle global : ${u.globalRole ?? 'USER'}`,
        `Actif : ${u.isActive !== false ? 'oui' : 'non'}`,
        u.createdAt ? `Créé : ${u.createdAt}` : null,
      ].filter(Boolean)
      return ok(lines.join('\n'))
    })

  define('admin', 'update_user', 'Met à jour un utilisateur (nom, email, rôle global, statut actif).',
    {
      userId: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
      globalRole: z.enum(['USER', 'ADMIN']).optional(),
      isActive: z.boolean().optional(),
    },
    async ({ userId, ...fields }) => {
      const u = await client.patch(`/admin/users/${userId}`, fields)
      return ok(`Utilisateur mis à jour : [${u.id}] ${u.name}`)
    })

  define('admin', 'delete_user', 'Supprime (désactive) un utilisateur SPOK.',
    { userId: z.string() },
    async ({ userId }) => {
      await client.delete(`/admin/users/${userId}`)
      return ok(`Utilisateur ${userId} supprimé.`)
    })

  define('admin', 'delete_contribution', 'Supprime une contribution.',
    { spaceId: z.string(), itemId: z.string(), contributionId: z.string() },
    async ({ spaceId, itemId, contributionId }) => {
      await client.delete(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`)
      return ok(`Contribution ${contributionId} supprimée.`)
    })

  // Tags d'espace (routes/tags.ts sur /spaces/:spaceId/tags). Les tags de communauté se gèrent dans l'UI.
  // Toute modification invalide le cache des conventions de l'espace.
  const assertColor = (color?: string) => {
    if (color !== undefined && !HEX_COLOR.test(color)) throw new ConventionError(`Couleur « ${color} » invalide : format attendu #RRGGBB (ex. #3b82f6).`)
  }

  define('admin', 'create_tag', 'Crée un tag dans un espace.',
    {
      spaceId: z.string().describe('ID de l\'espace'),
      name: z.string().min(1),
      color: z.string().optional().describe('Couleur hex #RRGGBB'),
    },
    async ({ spaceId, name, color }) => {
      assertColor(color)
      const t = await client.post(`/spaces/${spaceId}/tags`, color ? { name, color } : { name })
      conventionsCache.delete(spaceId)
      return ok(`Tag créé : [${t.id}] ${t.name}`)
    })

  define('admin', 'update_tag', 'Met à jour un tag d\'espace (nom, couleur).',
    { spaceId: z.string(), tagId: z.string(), name: z.string().min(1).optional(), color: z.string().optional().describe('Couleur hex #RRGGBB') },
    async ({ spaceId, tagId, ...fields }) => {
      assertColor(fields.color)
      const t = await client.patch(`/spaces/${spaceId}/tags/${tagId}`, fields)
      conventionsCache.delete(spaceId)
      return ok(`Tag mis à jour : [${t.id ?? tagId}] ${t.name ?? ''}`.trim())
    })

  define('admin', 'delete_tag', 'Supprime un tag d\'espace.',
    { spaceId: z.string(), tagId: z.string() },
    async ({ spaceId, tagId }) => {
      await client.delete(`/spaces/${spaceId}/tags/${tagId}`)
      conventionsCache.delete(spaceId)
      return ok(`Tag ${tagId} supprimé.`)
    })

  define('admin', 'list_space_members', 'Liste les membres d\'un espace.',
    { spaceId: z.string() },
    async ({ spaceId }) => {
      const members = asList(await client.get(`/spaces/${spaceId}/members`), 'data')
      const lines = members.map((m: any) =>
        `[${m.userId ?? m.user?.id}] ${m.user?.name ?? '?'} <${m.user?.email ?? '?'}> | ${m.role}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucun membre.')
    })

  define('admin', 'add_space_member', 'Ajoute un membre à un espace.',
    { spaceId: z.string(), userId: z.string(), role: z.enum(['OWNER', 'MEMBER', 'VIEWER']).default('MEMBER') },
    async ({ spaceId, userId, role }) => {
      await client.post(`/spaces/${spaceId}/members`, { userId, role })
      return ok(`Membre ajouté : ${userId} (${role})`)
    })

  define('admin', 'update_space_member', 'Met à jour le rôle d\'un membre dans un espace.',
    { spaceId: z.string(), userId: z.string(), role: z.enum(['OWNER', 'MEMBER', 'VIEWER']) },
    async ({ spaceId, userId, role }) => {
      await client.patch(`/spaces/${spaceId}/members/${userId}`, { role })
      return ok(`Rôle mis à jour : ${userId} → ${role}`)
    })

  define('admin', 'remove_space_member', 'Retire un membre d\'un espace.',
    { spaceId: z.string(), userId: z.string() },
    async ({ spaceId, userId }) => {
      await client.delete(`/spaces/${spaceId}/members/${userId}`)
      return ok(`Membre ${userId} retiré de l'espace ${spaceId}.`)
    })

  define('admin', 'list_community_members', 'Liste les membres d\'une communauté.',
    { communityId: z.string() },
    async ({ communityId }) => {
      const members = asList(await client.get(`/communities/${communityId}/members`), 'data')
      const lines = members.map((m: any) =>
        `[${m.userId ?? m.user?.id}] ${m.user?.name ?? '?'} <${m.user?.email ?? '?'}> | ${m.role}`)
      return ok(lines.length > 0 ? lines.join('\n') : 'Aucun membre.')
    })

  define('admin', 'add_community_member', 'Ajoute un membre à une communauté.',
    { communityId: z.string(), userId: z.string(), role: z.enum(['OWNER', 'MEMBER']).default('MEMBER') },
    async ({ communityId, userId, role }) => {
      await client.post(`/communities/${communityId}/members`, { userId, role })
      return ok(`Membre ajouté : ${userId} (${role})`)
    })

  define('admin', 'remove_community_member', 'Retire un membre d\'une communauté.',
    { communityId: z.string(), userId: z.string() },
    async ({ communityId, userId }) => {
      await client.delete(`/communities/${communityId}/members/${userId}`)
      return ok(`Membre ${userId} retiré de la communauté ${communityId}.`)
    })

  define('admin', 'delete_notification', 'Supprime une notification.',
    { notificationId: z.string() },
    async ({ notificationId }) => {
      await client.delete(`/notifications/${notificationId}`)
      return ok(`Notification ${notificationId} supprimée.`)
    })
}

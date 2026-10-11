/*
 * TNR des outils MCP SPOK via un client mémoire : sélection des outils par profil, validation des
 * conventions avant écriture (statut, type, dates, parent), conversion Markdown, erreurs renvoyées
 * en isError au lieu de faire planter le serveur.
 */
import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createSpokMcpServer, type ToolProfile } from './index.js'
import { SpokApiError } from './errors.js'
import type { SpokClient } from './client.js'

function fakeClient(): SpokClient & { post: any; patch: any; get: any } {
  return {
    get: vi.fn(async (path: string) => {
      if (path === '/spaces/s1/referentiels') return { referentiels: {
        statuses: [{ id: 'todo', label: 'À faire', order: 0, visible: true }, { id: 'in_progress', label: 'En cours', order: 1, visible: true }],
        typeLabels: { TASK: { label: 'Tâche', order: 0, visible: true }, PROJECT: { label: 'Projet', order: 1, visible: true } },
      } }
      if (path === '/spaces/s1/tags') return [
        { id: 't1', name: 'Urgent', color: '#ff0000', spaceId: 's1', isCommunityTag: false, itemCount: 3 },
        { id: 't2', name: 'UX', color: null, communityId: 'c1', isCommunityTag: true, itemCount: 0 },
      ]
      if (path === '/spaces/s1/items/p1') return { id: 'p1', spaceId: 's1', type: 'PROJECT', title: 'P' }
      if (path === '/spaces/s1/items/autre') throw new SpokApiError(404, 'not found', path)
      throw new Error(`GET inattendu ${path}`)
    }),
    post: vi.fn(async (_p: string, body: any) => ({ id: 'new', ...body })),
    patch: vi.fn(async (_p: string, body: any) => ({ id: 'i1', title: 'x', ...body })),
    delete: vi.fn(async () => ({})),
  }
}

async function connect(profile: ToolProfile, client = fakeClient()) {
  const server = createSpokMcpServer({ client, profile })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const mcp = new Client({ name: 'test', version: '0' })
  await Promise.all([server.connect(a), mcp.connect(b)])
  return { mcp, client }
}

const text = (r: any) => r.content.map((c: any) => c.text).join('\n')

describe('profils', () => {
  it('public : pas d\'outils d\'administration', async () => {
    const { mcp } = await connect('public')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('create_item')
    expect(names).toContain('get_space_conventions')
    for (const n of ['list_users', 'update_user', 'delete_user', 'delete_space', 'delete_community', 'add_space_member', 'create_community']) {
      expect(names).not.toContain(n)
    }
  })

  it('public-read : aucun outil d\'écriture', async () => {
    const { mcp } = await connect('public-read')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('get_item')
    for (const n of ['create_item', 'update_item', 'delete_item', 'create_relation', 'create_contribution', 'create_space']) {
      expect(names).not.toContain(n)
    }
  })

  it('admin : conserve les outils d\'administration', async () => {
    const { mcp } = await connect('admin')
    const names = (await mcp.listTools()).tools.map((t) => t.name)
    expect(names).toContain('list_users')
  })

  it('les instructions serveur sont transmises', async () => {
    const { mcp } = await connect('public')
    expect(mcp.getInstructions()).toContain('get_space_conventions')
  })
})

describe('create_item', () => {
  it('mappe le statut libellé, normalise les dates, convertit le Markdown', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: {
      spaceId: 's1', type: 'TASK', title: 'Rédiger', status: 'En cours', parentId: 'p1',
      startDate: '2026-10-12', endDate: '2026-10-15', description: '- point **un**',
    } })
    expect(r.isError).toBeFalsy()
    const body = client.post.mock.calls[0][1]
    expect(body.status).toBe('in_progress')
    expect(body.startDate).toBe('2026-10-12T00:00:00.000Z')
    expect(body.description).toContain('<strong>un</strong>')
  })

  it('statut inconnu → isError avec la liste, aucun POST', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', status: 'wip' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/todo \(À faire\)/)
    expect(client.post).not.toHaveBeenCalled()
  })

  it('type masqué → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'BUG', title: 'x' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/TASK \(Tâche\)/)
  })

  it('fin avant début → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', startDate: '2026-10-15', endDate: '2026-10-01' } })
    expect(r.isError).toBe(true)
  })

  it('parent hors de l\'espace → isError', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', parentId: 'autre' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/parent/i)
  })
})

describe('update_item', () => {
  it('valide le statut avant PATCH', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'update_item', arguments: { spaceId: 's1', itemId: 'i1', status: 'à faire' } })
    expect(r.isError).toBeFalsy()
    expect(client.patch.mock.calls[0][1].status).toBe('todo')
  })
})

describe('create_contribution', () => {
  it('envoie une chaîne HTML (le schéma API attend z.string)', async () => {
    const { mcp, client } = await connect('public')
    await mcp.callTool({ name: 'create_contribution', arguments: { spaceId: 's1', itemId: 'i1', content: 'Bonjour **toi**' } })
    const body = client.post.mock.calls[0][1]
    expect(typeof body.content).toBe('string')
    expect(body.content).toContain('<strong>toi</strong>')
  })
})

describe('tags', () => {
  it('create_item : noms de tags résolus en tagIds', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', tags: ['urgent', 't2'] } })
    expect(r.isError).toBeFalsy()
    expect(client.post.mock.calls[0][1].tagIds).toEqual(['t1', 't2'])
  })

  it('create_item : tag inconnu → isError, aucun POST', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'create_item', arguments: { spaceId: 's1', type: 'TASK', title: 'x', tags: ['perf'] } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/Urgent \[t1\]/)
    expect(client.post).not.toHaveBeenCalled()
  })

  it('update_item : tags [] efface les tags', async () => {
    const { mcp, client } = await connect('public')
    await mcp.callTool({ name: 'update_item', arguments: { spaceId: 's1', itemId: 'i1', tags: [] } })
    expect(client.patch.mock.calls[0][1].tagIds).toEqual([])
  })

  it('list_tags(spaceId) : route de l\'espace, origine indiquée', async () => {
    const { mcp, client } = await connect('public')
    const r = await mcp.callTool({ name: 'list_tags', arguments: { spaceId: 's1' } })
    expect(client.get).toHaveBeenCalledWith('/spaces/s1/tags')
    expect(text(r)).toMatch(/\[t1\] Urgent.*espace/)
    expect(text(r)).toMatch(/\[t2\] UX.*communauté/)
  })

  it('profils : gestion des tags réservée à admin, get_tag supprimé', async () => {
    const pub = (await (await connect('public')).mcp.listTools()).tools.map((t) => t.name)
    expect(pub).toContain('list_tags')
    for (const n of ['create_tag', 'update_tag', 'delete_tag', 'get_tag']) expect(pub).not.toContain(n)
    const adm = (await (await connect('admin')).mcp.listTools()).tools.map((t) => t.name)
    expect(adm).toEqual(expect.arrayContaining(['create_tag', 'update_tag', 'delete_tag']))
    expect(adm).not.toContain('get_tag')
  })

  it('create_tag : route de l\'espace, couleur hex validée', async () => {
    const { mcp, client } = await connect('admin')
    const bad = await mcp.callTool({ name: 'create_tag', arguments: { spaceId: 's1', name: 'Perf', color: 'rouge' } })
    expect(bad.isError).toBe(true)
    expect(client.post).not.toHaveBeenCalled()
    await mcp.callTool({ name: 'create_tag', arguments: { spaceId: 's1', name: 'Perf', color: '#00aa00' } })
    expect(client.post).toHaveBeenCalledWith('/spaces/s1/tags', { name: 'Perf', color: '#00aa00' })
  })

  it('update_tag / delete_tag : routes de l\'espace', async () => {
    const { mcp, client } = await connect('admin')
    await mcp.callTool({ name: 'update_tag', arguments: { spaceId: 's1', tagId: 't1', name: 'Critique' } })
    expect(client.patch).toHaveBeenCalledWith('/spaces/s1/tags/t1', { name: 'Critique' })
    await mcp.callTool({ name: 'delete_tag', arguments: { spaceId: 's1', tagId: 't1' } })
    expect(client.delete).toHaveBeenCalledWith('/spaces/s1/tags/t1')
  })
})

describe('erreurs API', () => {
  it('une 404 API devient isError lisible', async () => {
    const { mcp } = await connect('public')
    const r = await mcp.callTool({ name: 'get_item', arguments: { spaceId: 's1', itemId: 'autre' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/404/)
  })
})

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { api } from './client.js';

const server = new McpServer({
  name: 'spok',
  version: '0.1.0',
});

// ─── list_spaces ─────────────────────────────────────────────────────────────

server.tool(
  'list_spaces',
  'Liste les espaces SPOK accessibles par le token. Peut filtrer par communauté.',
  {
    communityId: z.string().optional().describe('ID de communauté pour filtrer (optionnel)'),
  },
  async ({ communityId }) => {
    const qs = communityId ? `?communityId=${communityId}` : '';
    const data = await api.get(`/spaces${qs}`);

    const spaces = Array.isArray(data) ? data : (data.spaces ?? data.data ?? []);

    const lines = spaces.map((s: any) =>
      `[${s.id}] ${s.name}${s.description ? ` — ${s.description}` : ''} | visibilité: ${s.visibility ?? '?'}${s.communityId ? ` | communauté: ${s.communityId}` : ''}${s.parentId ? ` | parent: ${s.parentId}` : ''}`
    );

    return {
      content: [
        {
          type: 'text',
          text: lines.length > 0 ? lines.join('\n') : 'Aucun espace accessible.',
        },
      ],
    };
  }
);

// ─── get_space ────────────────────────────────────────────────────────────────

server.tool(
  'get_space',
  'Retourne le détail d\'un espace SPOK et ses items.',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    limit: z.number().optional().default(200).describe('Nombre max d\'items à retourner (défaut 200)'),
  },
  async ({ spaceId, limit }) => {
    const [space, itemsRes] = await Promise.all([
      api.get(`/spaces/${spaceId}`),
      api.get(`/spaces/${spaceId}/items?pageSize=${limit}`),
    ]);

    const items = itemsRes.data ?? itemsRes.items ?? itemsRes ?? [];

    const header = [
      `# ${space.name}`,
      space.description ? `Description : ${space.description}` : null,
      `Visibilité : ${space.visibility ?? '?'}`,
      space.communityId ? `Communauté : ${space.communityId}` : null,
      space.parentId ? `Parent : ${space.parentId}` : null,
      `Items : ${items.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    const itemLines = items.map((item: any) => {
      const parts = [`[${item.id}] [${item.type}] ${item.title}`];
      if (item.status) parts.push(`statut: ${item.status}`);
      if (item.priority) parts.push(`priorité: ${item.priority}`);
      if (item.startDate) parts.push(`début: ${item.startDate.slice(0, 10)}`);
      if (item.endDate) parts.push(`fin: ${item.endDate.slice(0, 10)}`);
      if (item.dueDate) parts.push(`échéance: ${item.dueDate.slice(0, 10)}`);
      if (item.url) parts.push(`url: ${item.url}`);
      if (item.parentId) parts.push(`parent: ${item.parentId}`);
      const text = extractText(item.content ?? item.description);
      if (text) parts.push(`→ ${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`);
      return parts.join(' | ');
    });

    return {
      content: [
        {
          type: 'text',
          text: [header, '', ...itemLines].join('\n'),
        },
      ],
    };
  }
);

// ─── search_items ─────────────────────────────────────────────────────────────

server.tool(
  'search_items',
  'Recherche des items dans SPOK par mot-clé. Retourne les items correspondants avec leur espace.',
  {
    q: z.string().describe('Termes de recherche'),
    limit: z.number().optional().default(20).describe('Nombre max de résultats (défaut 20)'),
  },
  async ({ q, limit }) => {
    const data = await api.get(`/search?q=${encodeURIComponent(q)}&pageSize=${limit}`);

    const items = data.items?.data ?? data.items ?? data.data ?? [];

    if (items.length === 0) {
      return {
        content: [{ type: 'text', text: `Aucun résultat pour "${q}".` }],
      };
    }

    const lines = items.map((item: any) => {
      const parts = [`[${item.id}] [${item.type}] ${item.title}`];
      if (item.space?.name) parts.push(`espace: ${item.space.name}`);
      if (item.status) parts.push(`statut: ${item.status}`);
      if (item.priority) parts.push(`priorité: ${item.priority}`);
      if (item.startDate) parts.push(`début: ${item.startDate.slice(0, 10)}`);
      if (item.endDate) parts.push(`fin: ${item.endDate.slice(0, 10)}`);
      if (item.dueDate) parts.push(`échéance: ${item.dueDate.slice(0, 10)}`);
      if (item.url) parts.push(`url: ${item.url}`);
      const text = extractText(item.content ?? item.description);
      if (text) parts.push(`→ ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);
      return parts.join(' | ');
    });

    return {
      content: [
        {
          type: 'text',
          text: `${lines.length} résultat(s) pour "${q}" :\n\n${lines.join('\n')}`,
        },
      ],
    };
  }
);

// ─── create_item ──────────────────────────────────────────────────────────────

const ITEM_TYPES = ['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const;

server.tool(
  'create_item',
  'Crée un item dans un espace SPOK. Retourne l\'ID et le titre de l\'item créé.',
  {
    spaceId: z.string().describe('ID de l\'espace cible'),
    type: z.enum(ITEM_TYPES).describe('Type d\'item'),
    title: z.string().describe('Titre de l\'item'),
    description: z.string().optional().describe('Description textuelle (optionnel)'),
    status: z.string().optional().describe('Statut (optionnel, ex: todo, in_progress, done)'),
    priority: z.number().int().min(1).max(4).optional().describe('Priorité 1-4 (optionnel)'),
    parentId: z.string().optional().describe('ID de l\'item parent (optionnel)'),
    startDate: z.string().optional().describe('Date de début ISO 8601 (optionnel)'),
    endDate: z.string().optional().describe('Date de fin ISO 8601 (optionnel)'),
    dueDate: z.string().optional().describe('Date d\'échéance ISO 8601 (optionnel)'),
    url: z.string().optional().describe('URL associée (optionnel)'),
  },
  async ({ spaceId, type, title, description, status, priority, parentId, startDate, endDate, dueDate, url }) => {
    const body: Record<string, unknown> = { type, title };
    if (description) body.description = textToHtml(description);
    if (status) body.status = status;
    if (priority) body.priority = priority;
    if (parentId) body.parentId = parentId;
    if (startDate) body.startDate = startDate;
    if (endDate) body.endDate = endDate;
    if (dueDate) body.dueDate = dueDate;
    if (url) body.url = url;

    const item = await api.post(`/spaces/${spaceId}/items`, body);

    return {
      content: [
        {
          type: 'text',
          text: `Item créé : [${item.id}] [${item.type}] ${item.title}`,
        },
      ],
    };
  }
);

// ─── list_items ───────────────────────────────────────────────────────────────

server.tool(
  'list_items',
  'Liste les items d\'un espace SPOK avec filtres optionnels.',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    type: z.string().optional().describe('Filtrer par type (NOTE, TASK, PROJECT…)'),
    status: z.string().optional().describe('Filtrer par statut (todo, in_progress, done…)'),
    parentId: z.string().optional().describe('Filtrer par parent (null = racine)'),
    pageSize: z.number().optional().default(100).describe('Nombre max de résultats (défaut 100)'),
    page: z.number().optional().default(1).describe('Page (défaut 1)'),
  },
  async ({ spaceId, type, status, parentId, pageSize, page }) => {
    const params = new URLSearchParams({ pageSize: String(pageSize), page: String(page) });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (parentId) params.set('parentId', parentId);

    const data = await api.get(`/spaces/${spaceId}/items?${params}`);
    const items = data.data ?? data.items ?? data ?? [];

    const lines = items.map((item: any) => {
      const parts = [`[${item.id}] [${item.type}] ${item.title}`];
      if (item.status) parts.push(`statut: ${item.status}`);
      if (item.priority) parts.push(`priorité: ${item.priority}`);
      if (item.startDate) parts.push(`début: ${item.startDate.slice(0, 10)}`);
      if (item.endDate) parts.push(`fin: ${item.endDate.slice(0, 10)}`);
      if (item.dueDate) parts.push(`échéance: ${item.dueDate.slice(0, 10)}`);
      if (item.url) parts.push(`url: ${item.url}`);
      if (item.parentId) parts.push(`parent: ${item.parentId}`);
      const text = extractText(item.content ?? item.description);
      if (text) parts.push(`→ ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);
      return parts.join(' | ');
    });

    return {
      content: [{ type: 'text', text: lines.length > 0 ? `${lines.length} item(s) :\n\n${lines.join('\n')}` : 'Aucun item.' }],
    };
  }
);

// ─── get_item ─────────────────────────────────────────────────────────────────

server.tool(
  'get_item',
  'Retourne le détail complet d\'un item SPOK (tous les champs + contenu).',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    itemId: z.string().describe('ID de l\'item'),
  },
  async ({ spaceId, itemId }) => {
    const item = await api.get(`/spaces/${spaceId}/items/${itemId}`);

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
    ].filter(Boolean);

    const text = extractText(item.content ?? item.description);
    if (text) lines.push(`\nContenu :\n${text}`);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }
);

// ─── update_item ──────────────────────────────────────────────────────────────

server.tool(
  'update_item',
  'Met à jour un item SPOK (titre, description, statut, priorité, type, dates, url, parentId).',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    itemId: z.string().describe('ID de l\'item'),
    title: z.string().optional().describe('Nouveau titre'),
    description: z.string().optional().describe('Nouvelle description (texte brut)'),
    status: z.string().optional().describe('Nouveau statut'),
    priority: z.number().int().min(1).max(4).optional().describe('Priorité 1-4'),
    type: z.string().optional().describe('Nouveau type'),
    dueDate: z.string().optional().describe('Date d\'échéance ISO 8601'),
    startDate: z.string().optional().describe('Date de début ISO 8601'),
    endDate: z.string().optional().describe('Date de fin ISO 8601'),
    url: z.string().optional().describe('URL associée'),
    parentId: z.string().nullable().optional().describe('Nouveau parent (null = racine)'),
  },
  async ({ spaceId, itemId, description, ...fields }) => {
    const body: Record<string, unknown> = { ...fields };
    if (description !== undefined) {
      body.description = textToHtml(description);
    }

    const item = await api.patch(`/spaces/${spaceId}/items/${itemId}`, body);

    return {
      content: [{ type: 'text', text: `Item mis à jour : [${item.id}] ${item.title}` }],
    };
  }
);

// ─── delete_item ──────────────────────────────────────────────────────────────

server.tool(
  'delete_item',
  'Supprime un item SPOK.',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    itemId: z.string().describe('ID de l\'item'),
    deleteChildren: z.boolean().optional().default(false).describe('Supprimer aussi les enfants (défaut false)'),
  },
  async ({ spaceId, itemId, deleteChildren }) => {
    const qs = deleteChildren ? '?deleteChildren=true' : '';
    await api.delete(`/spaces/${spaceId}/items/${itemId}${qs}`);
    return {
      content: [{ type: 'text', text: `Item ${itemId} supprimé.` }],
    };
  }
);

// ─── create_space ─────────────────────────────────────────────────────────────

server.tool(
  'create_space',
  'Crée un espace SPOK dans une communauté.',
  {
    name: z.string().describe('Nom de l\'espace'),
    communityId: z.string().describe('ID de la communauté parente'),
    parentId: z.string().optional().describe('ID de l\'espace parent (pour sous-espace)'),
    description: z.string().optional().describe('Description de l\'espace'),
    visibility: z.enum(['PRIVATE', 'OPEN', 'READONLY']).optional().default('PRIVATE').describe('Visibilité'),
  },
  async ({ name, communityId, parentId, description, visibility }) => {
    const body: Record<string, unknown> = { name, communityId, visibility };
    if (parentId) body.parentId = parentId;
    if (description) body.description = description;

    const space = await api.post('/spaces', body);
    return {
      content: [{ type: 'text', text: `Espace créé : [${space.id}] ${space.name}` }],
    };
  }
);

// ─── update_space ─────────────────────────────────────────────────────────────

server.tool(
  'update_space',
  'Met à jour un espace SPOK (nom, description, visibilité).',
  {
    spaceId: z.string().describe('ID de l\'espace'),
    name: z.string().optional().describe('Nouveau nom'),
    description: z.string().optional().describe('Nouvelle description'),
    visibility: z.enum(['PRIVATE', 'OPEN', 'READONLY']).optional().describe('Nouvelle visibilité'),
  },
  async ({ spaceId, ...fields }) => {
    const space = await api.patch(`/spaces/${spaceId}`, fields);
    return {
      content: [{ type: 'text', text: `Espace mis à jour : [${space.id}] ${space.name}` }],
    };
  }
);

// ─── delete_space ─────────────────────────────────────────────────────────────

server.tool(
  'delete_space',
  'Supprime un espace SPOK.',
  {
    spaceId: z.string().describe('ID de l\'espace'),
  },
  async ({ spaceId }) => {
    await api.delete(`/spaces/${spaceId}`);
    return {
      content: [{ type: 'text', text: `Espace ${spaceId} supprimé.` }],
    };
  }
);

// ─── list_communities ─────────────────────────────────────────────────────────

server.tool(
  'list_communities',
  'Liste les communautés SPOK accessibles.',
  {},
  async () => {
    const data = await api.get('/communities');
    const communities = Array.isArray(data) ? data : (data.communities ?? data.data ?? []);

    const lines = communities.map((c: any) =>
      `[${c.id}] ${c.name}${c.description ? ` — ${c.description}` : ''}${c.isPublic ? ' (publique)' : ''}`
    );

    return {
      content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucune communauté.' }],
    };
  }
);

// ─── get_community ────────────────────────────────────────────────────────────

server.tool(
  'get_community',
  'Retourne le détail d\'une communauté SPOK et ses espaces.',
  {
    communityId: z.string().describe('ID de la communauté'),
  },
  async ({ communityId }) => {
    const [community, spacesData] = await Promise.all([
      api.get(`/communities/${communityId}`),
      api.get(`/spaces?communityId=${communityId}`),
    ]);

    const spaces = Array.isArray(spacesData) ? spacesData : (spacesData.spaces ?? spacesData.data ?? []);

    const lines = [
      `# ${community.name}`,
      community.description ? `Description : ${community.description}` : null,
      `Visibilité : ${community.isPublic ? 'Publique' : 'Privée'}`,
      `Espaces (${spaces.length}) :`,
      ...spaces.map((s: any) => `  [${s.id}] ${s.name} | visibilité: ${s.visibility ?? '?'}${s.parentId ? ` | parent: ${s.parentId}` : ''}`),
    ].filter(Boolean);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }
);

// ─── create_community ─────────────────────────────────────────────────────────

server.tool(
  'create_community',
  'Crée une communauté SPOK.',
  {
    name: z.string().describe('Nom de la communauté'),
    description: z.string().optional().describe('Description'),
    isPublic: z.boolean().optional().default(false).describe('Communauté publique (défaut false)'),
  },
  async ({ name, description, isPublic }) => {
    const body: Record<string, unknown> = { name, isPublic };
    if (description) body.description = description;

    const community = await api.post('/communities', body);
    return {
      content: [{ type: 'text', text: `Communauté créée : [${community.id}] ${community.name}` }],
    };
  }
);

// ─── update_community ─────────────────────────────────────────────────────────

server.tool(
  'update_community',
  'Met à jour une communauté SPOK (nom, description, visibilité).',
  {
    communityId: z.string().describe('ID de la communauté'),
    name: z.string().optional().describe('Nouveau nom'),
    description: z.string().optional().describe('Nouvelle description'),
    isPublic: z.boolean().optional().describe('Rendre publique ou privée'),
  },
  async ({ communityId, ...fields }) => {
    const community = await api.patch(`/communities/${communityId}`, fields);
    return {
      content: [{ type: 'text', text: `Communauté mise à jour : [${community.id}] ${community.name}` }],
    };
  }
);

// ─── delete_community ─────────────────────────────────────────────────────────

server.tool(
  'delete_community',
  'Supprime une communauté SPOK.',
  {
    communityId: z.string().describe('ID de la communauté'),
  },
  async ({ communityId }) => {
    await api.delete(`/communities/${communityId}`);
    return {
      content: [{ type: 'text', text: `Communauté ${communityId} supprimée.` }],
    };
  }
);

// ─── list_users ───────────────────────────────────────────────────────────────

server.tool(
  'list_users',
  'Liste les utilisateurs SPOK.',
  {
    page: z.number().optional().default(1),
    pageSize: z.number().optional().default(50),
    search: z.string().optional().describe('Recherche par nom ou email'),
  },
  async ({ page, pageSize, search }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    const data = await api.get(`/admin/users?${params}`);
    const users = data.data ?? data.users ?? data ?? [];
    const lines = users.map((u: any) =>
      `[${u.id}] ${u.name} <${u.email}> | rôle: ${u.globalRole ?? 'USER'}${u.isActive === false ? ' | DÉSACTIVÉ' : ''}`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucun utilisateur.' }] };
  }
);

// ─── get_user ─────────────────────────────────────────────────────────────────

server.tool(
  'get_user',
  'Retourne le détail d\'un utilisateur SPOK.',
  { userId: z.string() },
  async ({ userId }) => {
    const u = await api.get(`/admin/users/${userId}`);
    const lines = [
      `[${u.id}] ${u.name} <${u.email}>`,
      `Rôle global : ${u.globalRole ?? 'USER'}`,
      `Actif : ${u.isActive !== false ? 'oui' : 'non'}`,
      u.createdAt ? `Créé : ${u.createdAt}` : null,
    ].filter(Boolean);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ─── update_user ──────────────────────────────────────────────────────────────

server.tool(
  'update_user',
  'Met à jour un utilisateur (nom, email, rôle global, statut actif).',
  {
    userId: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
    globalRole: z.enum(['USER', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
  },
  async ({ userId, ...fields }) => {
    const u = await api.patch(`/admin/users/${userId}`, fields);
    return { content: [{ type: 'text', text: `Utilisateur mis à jour : [${u.id}] ${u.name}` }] };
  }
);

// ─── delete_user ──────────────────────────────────────────────────────────────

server.tool(
  'delete_user',
  'Supprime (désactive) un utilisateur SPOK.',
  { userId: z.string() },
  async ({ userId }) => {
    await api.delete(`/admin/users/${userId}`);
    return { content: [{ type: 'text', text: `Utilisateur ${userId} supprimé.` }] };
  }
);

// ─── list_contributions ───────────────────────────────────────────────────────

server.tool(
  'list_contributions',
  'Liste les contributions (commentaires) d\'un item.',
  {
    spaceId: z.string(),
    itemId: z.string(),
  },
  async ({ spaceId, itemId }) => {
    const data = await api.get(`/spaces/${spaceId}/items/${itemId}/contributions`);
    const contributions = data.data ?? data ?? [];
    const lines = contributions.map((c: any) =>
      `[${c.id}] ${c.author?.name ?? '?'} (${c.createdAt?.slice(0, 10) ?? ''}) :\n${extractText(c.content)}`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n\n') : 'Aucune contribution.' }] };
  }
);

// ─── get_contribution ─────────────────────────────────────────────────────────

server.tool(
  'get_contribution',
  'Retourne le détail d\'une contribution.',
  { spaceId: z.string(), itemId: z.string(), contributionId: z.string() },
  async ({ spaceId, itemId, contributionId }) => {
    const data = await api.get(`/spaces/${spaceId}/items/${itemId}/contributions`);
    const contributions = data.data ?? data ?? [];
    const c = contributions.find((x: any) => x.id === contributionId);
    if (!c) return { content: [{ type: 'text', text: 'Contribution non trouvée.' }] };
    return { content: [{ type: 'text', text: `[${c.id}] ${c.author?.name ?? '?'}\n${extractText(c.content)}` }] };
  }
);

// ─── create_contribution ──────────────────────────────────────────────────────

server.tool(
  'create_contribution',
  'Ajoute une contribution (commentaire) à un item.',
  {
    spaceId: z.string(),
    itemId: z.string(),
    content: z.string().describe('Texte de la contribution'),
  },
  async ({ spaceId, itemId, content }) => {
    const c = await api.post(`/spaces/${spaceId}/items/${itemId}/contributions`, {
      content: textToTiptap(content),
    });
    return { content: [{ type: 'text', text: `Contribution créée : [${c.id}]` }] };
  }
);

// ─── update_contribution ──────────────────────────────────────────────────────

server.tool(
  'update_contribution',
  'Met à jour le contenu d\'une contribution.',
  {
    spaceId: z.string(),
    itemId: z.string(),
    contributionId: z.string(),
    content: z.string(),
  },
  async ({ spaceId, itemId, contributionId, content }) => {
    const c = await api.patch(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`, {
      content: textToTiptap(content),
    });
    return { content: [{ type: 'text', text: `Contribution mise à jour : [${c.id}]` }] };
  }
);

// ─── delete_contribution ──────────────────────────────────────────────────────

server.tool(
  'delete_contribution',
  'Supprime une contribution.',
  { spaceId: z.string(), itemId: z.string(), contributionId: z.string() },
  async ({ spaceId, itemId, contributionId }) => {
    await api.delete(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`);
    return { content: [{ type: 'text', text: `Contribution ${contributionId} supprimée.` }] };
  }
);

// ─── list_tags ────────────────────────────────────────────────────────────────

server.tool(
  'list_tags',
  'Liste les tags SPOK.',
  { communityId: z.string().optional().describe('Filtrer par communauté') },
  async ({ communityId }) => {
    const qs = communityId ? `?communityId=${communityId}` : '';
    const data = await api.get(`/tags${qs}`);
    const tags = Array.isArray(data) ? data : (data.data ?? []);
    const lines = tags.map((t: any) => `[${t.id}] ${t.name}${t.color ? ` (${t.color})` : ''}`);
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucun tag.' }] };
  }
);

// ─── get_tag ──────────────────────────────────────────────────────────────────

server.tool(
  'get_tag',
  'Retourne le détail d\'un tag.',
  { tagId: z.string() },
  async ({ tagId }) => {
    const t = await api.get(`/tags/${tagId}`);
    return { content: [{ type: 'text', text: `[${t.id}] ${t.name}${t.color ? ` | couleur: ${t.color}` : ''}` }] };
  }
);

// ─── create_tag ───────────────────────────────────────────────────────────────

server.tool(
  'create_tag',
  'Crée un tag SPOK.',
  {
    name: z.string(),
    color: z.string().optional().describe('Couleur hex ou nom'),
    communityId: z.string().optional(),
  },
  async (body) => {
    const t = await api.post('/tags', body);
    return { content: [{ type: 'text', text: `Tag créé : [${t.id}] ${t.name}` }] };
  }
);

// ─── update_tag ───────────────────────────────────────────────────────────────

server.tool(
  'update_tag',
  'Met à jour un tag (nom, couleur).',
  { tagId: z.string(), name: z.string().optional(), color: z.string().optional() },
  async ({ tagId, ...fields }) => {
    const t = await api.patch(`/tags/${tagId}`, fields);
    return { content: [{ type: 'text', text: `Tag mis à jour : [${t.id}] ${t.name}` }] };
  }
);

// ─── delete_tag ───────────────────────────────────────────────────────────────

server.tool(
  'delete_tag',
  'Supprime un tag.',
  { tagId: z.string() },
  async ({ tagId }) => {
    await api.delete(`/tags/${tagId}`);
    return { content: [{ type: 'text', text: `Tag ${tagId} supprimé.` }] };
  }
);

// ─── list_space_members ───────────────────────────────────────────────────────

server.tool(
  'list_space_members',
  'Liste les membres d\'un espace.',
  { spaceId: z.string() },
  async ({ spaceId }) => {
    const data = await api.get(`/spaces/${spaceId}/members`);
    const members = Array.isArray(data) ? data : (data.data ?? []);
    const lines = members.map((m: any) =>
      `[${m.userId ?? m.user?.id}] ${m.user?.name ?? '?'} <${m.user?.email ?? '?'}> | ${m.role}`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucun membre.' }] };
  }
);

// ─── add_space_member ─────────────────────────────────────────────────────────

server.tool(
  'add_space_member',
  'Ajoute un membre à un espace.',
  {
    spaceId: z.string(),
    userId: z.string(),
    role: z.enum(['OWNER', 'MEMBER', 'VIEWER']).default('MEMBER'),
  },
  async ({ spaceId, userId, role }) => {
    await api.post(`/spaces/${spaceId}/members`, { userId, role });
    return { content: [{ type: 'text', text: `Membre ajouté : ${userId} (${role})` }] };
  }
);

// ─── update_space_member ──────────────────────────────────────────────────────

server.tool(
  'update_space_member',
  'Met à jour le rôle d\'un membre dans un espace.',
  {
    spaceId: z.string(),
    userId: z.string(),
    role: z.enum(['OWNER', 'MEMBER', 'VIEWER']),
  },
  async ({ spaceId, userId, role }) => {
    await api.patch(`/spaces/${spaceId}/members/${userId}`, { role });
    return { content: [{ type: 'text', text: `Rôle mis à jour : ${userId} → ${role}` }] };
  }
);

// ─── remove_space_member ──────────────────────────────────────────────────────

server.tool(
  'remove_space_member',
  'Retire un membre d\'un espace.',
  { spaceId: z.string(), userId: z.string() },
  async ({ spaceId, userId }) => {
    await api.delete(`/spaces/${spaceId}/members/${userId}`);
    return { content: [{ type: 'text', text: `Membre ${userId} retiré de l\'espace ${spaceId}.` }] };
  }
);

// ─── list_community_members ───────────────────────────────────────────────────

server.tool(
  'list_community_members',
  'Liste les membres d\'une communauté.',
  { communityId: z.string() },
  async ({ communityId }) => {
    const data = await api.get(`/communities/${communityId}/members`);
    const members = Array.isArray(data) ? data : (data.data ?? []);
    const lines = members.map((m: any) =>
      `[${m.userId ?? m.user?.id}] ${m.user?.name ?? '?'} <${m.user?.email ?? '?'}> | ${m.role}`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucun membre.' }] };
  }
);

// ─── add_community_member ─────────────────────────────────────────────────────

server.tool(
  'add_community_member',
  'Ajoute un membre à une communauté.',
  {
    communityId: z.string(),
    userId: z.string(),
    role: z.enum(['OWNER', 'MEMBER']).default('MEMBER'),
  },
  async ({ communityId, userId, role }) => {
    await api.post(`/communities/${communityId}/members`, { userId, role });
    return { content: [{ type: 'text', text: `Membre ajouté : ${userId} (${role})` }] };
  }
);

// ─── remove_community_member ──────────────────────────────────────────────────

server.tool(
  'remove_community_member',
  'Retire un membre d\'une communauté.',
  { communityId: z.string(), userId: z.string() },
  async ({ communityId, userId }) => {
    await api.delete(`/communities/${communityId}/members/${userId}`);
    return { content: [{ type: 'text', text: `Membre ${userId} retiré de la communauté ${communityId}.` }] };
  }
);

// ─── list_notifications ───────────────────────────────────────────────────────

server.tool(
  'list_notifications',
  'Liste les notifications de l\'utilisateur connecté.',
  { unreadOnly: z.boolean().optional().default(false) },
  async ({ unreadOnly }) => {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const data = await api.get(`/notifications${qs}`);
    const notifs = Array.isArray(data) ? data : (data.data ?? []);
    const lines = notifs.map((n: any) =>
      `[${n.id}] ${n.read ? '✓' : '●'} ${n.type} — ${n.message ?? ''} (${n.createdAt?.slice(0, 10) ?? ''})`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucune notification.' }] };
  }
);

// ─── mark_notification_read ───────────────────────────────────────────────────

server.tool(
  'mark_notification_read',
  'Marque une notification comme lue (ou toutes si notificationId omis).',
  { notificationId: z.string().optional().describe('ID de la notification, ou omis pour tout marquer lu') },
  async ({ notificationId }) => {
    if (notificationId) {
      await api.patch(`/notifications/${notificationId}`, { read: true });
      return { content: [{ type: 'text', text: `Notification ${notificationId} marquée lue.` }] };
    }
    await api.patch('/notifications/read-all', {});
    return { content: [{ type: 'text', text: 'Toutes les notifications marquées lues.' }] };
  }
);

// ─── delete_notification ──────────────────────────────────────────────────────

server.tool(
  'delete_notification',
  'Supprime une notification.',
  { notificationId: z.string() },
  async ({ notificationId }) => {
    await api.delete(`/notifications/${notificationId}`);
    return { content: [{ type: 'text', text: `Notification ${notificationId} supprimée.` }] };
  }
);

// ─── list_relations ───────────────────────────────────────────────────────────

server.tool(
  'list_relations',
  'Liste les relations d\'un item.',
  { spaceId: z.string(), itemId: z.string() },
  async ({ spaceId, itemId }) => {
    const data = await api.get(`/spaces/${spaceId}/items/${itemId}/relations`);
    const relations = Array.isArray(data) ? data : (data.data ?? []);
    const lines = relations.map((r: any) =>
      `[${r.id}] ${r.type}${r.label ? ` (${r.label})` : ''} → [${r.toItemId ?? r.toItem?.id}] ${r.toItem?.title ?? ''}`
    );
    return { content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'Aucune relation.' }] };
  }
);

// ─── create_relation ──────────────────────────────────────────────────────────

server.tool(
  'create_relation',
  'Crée une relation entre deux items.',
  {
    spaceId: z.string(),
    itemId: z.string().describe('Item source'),
    toItemId: z.string().describe('Item cible'),
    type: z.string().describe('Type de relation (ex: RELATED, BLOCKS, DEPENDS_ON)'),
    label: z.string().optional(),
  },
  async ({ spaceId, itemId, toItemId, type, label }) => {
    const body: Record<string, unknown> = { toItemId, type };
    if (label) body.label = label;
    const r = await api.post(`/spaces/${spaceId}/items/${itemId}/relations`, body);
    return { content: [{ type: 'text', text: `Relation créée : [${r.id}] ${type}` }] };
  }
);

// ─── update_relation ──────────────────────────────────────────────────────────

server.tool(
  'update_relation',
  'Met à jour le type ou le label d\'une relation.',
  {
    spaceId: z.string(),
    itemId: z.string(),
    relationId: z.string(),
    type: z.string().optional(),
    label: z.string().nullable().optional(),
  },
  async ({ spaceId, itemId, relationId, ...fields }) => {
    const r = await api.patch(`/spaces/${spaceId}/items/${itemId}/relations/${relationId}`, fields);
    return { content: [{ type: 'text', text: `Relation mise à jour : [${r.id}]` }] };
  }
);

// ─── delete_relation ──────────────────────────────────────────────────────────

server.tool(
  'delete_relation',
  'Supprime une relation entre items.',
  { spaceId: z.string(), itemId: z.string(), relationId: z.string() },
  async ({ spaceId, itemId, relationId }) => {
    await api.delete(`/spaces/${spaceId}/items/${itemId}/relations/${relationId}`);
    return { content: [{ type: 'text', text: `Relation ${relationId} supprimée.` }] };
  }
);

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractText(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') {
    let parsed: any;
    try { parsed = JSON.parse(description); } catch { /* not JSON — treat as HTML */ }
    if (parsed) {
      description = parsed;
    } else {
      return description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  if (typeof description !== 'object') return '';
  function collectText(node: any): string {
    if (node.type === 'text') return node.text ?? '';
    return (node.content ?? []).map(collectText).join(' ');
  }
  return (description.content ?? []).map(collectText).join('\n').trim();
}

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '<p></p>' : `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`))
    .join('');
}

function textToTiptap(text: string) {
  const content = text.split('\n').map((line) => {
    if (line.trim() === '') return { type: 'paragraph' };
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });
  return { type: 'doc', content };
}

// ─── start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

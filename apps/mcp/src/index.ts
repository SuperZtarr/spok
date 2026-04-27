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
      `[${s.id}] ${s.name}${s.description ? ` — ${s.description}` : ''}${s.parentId ? ` (parent: ${s.parentId})` : ''}`
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
  'Retourne le détail d\'un espace SPOK et ses items (titre, type, statut, description).',
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
      `Items : ${items.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    const itemLines = items.map((item: any) => {
      const parts = [`[${item.id}] [${item.type}] ${item.title}`];
      if (item.status) parts.push(`statut: ${item.status}`);
      if (item.description) {
        const text = extractText(item.description);
        if (text) parts.push(`→ ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);
      }
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

    const lines = items.map((item: any) =>
      `[${item.id}] [${item.type}] ${item.title}${item.space?.name ? ` (${item.space.name})` : ''}${item.status ? ` | ${item.status}` : ''}`
    );

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
    parentId: z.string().optional().describe('ID de l\'item parent pour créer une hiérarchie (optionnel)'),
    dueDate: z.string().optional().describe('Date d\'échéance ISO 8601 (optionnel)'),
  },
  async ({ spaceId, type, title, description, status, priority, parentId, dueDate }) => {
    const body: Record<string, unknown> = { type, title };
    if (description) body.content = textToTiptap(description);
    if (status) body.status = status;
    if (priority) body.priority = priority;
    if (parentId) body.parentId = parentId;
    if (dueDate) body.dueDate = dueDate;

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

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractText(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') {
    try { description = JSON.parse(description); } catch { return description; }
  }
  if (typeof description !== 'object') return '';
  function collectText(node: any): string {
    if (node.type === 'text') return node.text ?? '';
    return (node.content ?? []).map(collectText).join(' ');
  }
  return (description.content ?? []).map(collectText).join(' ').replace(/\s+/g, ' ').trim();
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

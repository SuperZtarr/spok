# Duplicates Admin View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin page `/admin/duplicates` that groups items with the same normalized title, same URL (LINK type), or same filename (IMAGE/DOCUMENT type) across all spaces, and displays them as cards with a breadcrumb (Communauté > Espace > Grand-parent > Parent) and context actions.

**Architecture:** Backend endpoint `GET /admin/duplicates` uses `$queryRawUnsafe` with `LOWER(TRIM(REGEXP_REPLACE(...)))` normalization and two levels of parent JOINs for the breadcrumb. Frontend page shows grouped duplicate cards with tabs by reason. Menu entry added to `DEFAULT_MENU_ITEMS`.

**Tech Stack:** Fastify + Prisma (`$queryRawUnsafe`), React + TanStack Query, Tailwind CSS, Lucide icons.

---

## File Map

| Action | File |
|--------|------|
| CREATE | `apps/api/src/routes/admin/duplicates.ts` |
| MODIFY | `apps/api/src/index.ts` — import + register at `/admin/duplicates` |
| MODIFY | `apps/web/src/lib/api.ts` — add `adminApi.duplicates` |
| CREATE | `apps/web/src/pages/admin/DuplicatesPage.tsx` |
| MODIFY | `apps/web/src/App.tsx` — import + route `/admin/duplicates` |
| MODIFY | `packages/shared/src/constants/menuDefaults.ts` — add `admin-duplicates` menu item |

---

## Task 1 — Backend: `GET /admin/duplicates`

**Files:**
- Create: `apps/api/src/routes/admin/duplicates.ts`

- [ ] **Step 1: Create the route file**

```typescript
// apps/api/src/routes/admin/duplicates.ts
import { FastifyPluginAsync } from 'fastify';

interface RawItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  priority: number | null;
  createdAt: string;
  spaceId: string;
  spaceName: string;
  communityId: string | null;
  communityName: string | null;
  parentId: string | null;
  parentTitle: string | null;
  grandparentId: string | null;
  grandparentTitle: string | null;
}

interface Ancestor {
  id: string;
  title: string;
}

interface DuplicateItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  priority: number | null;
  createdAt: string;
  spaceId: string;
  spaceName: string;
  communityId: string | null;
  communityName: string | null;
  ancestors: Ancestor[]; // [grandparent?, parent?] — nearest last
}

interface DuplicateGroup {
  key: string;
  reason: 'title' | 'url' | 'filename';
  items: DuplicateItem[];
}

// Two levels of parent JOINs for breadcrumb
const ITEM_SELECT = `
  i.id, i.title, i.type, i.url, i.status, i.priority,
  i."createdAt"::text as "createdAt", i."spaceId",
  s.name as "spaceName", s."communityId",
  c.name as "communityName",
  p.id as "parentId", p.title as "parentTitle",
  gp.id as "grandparentId", gp.title as "grandparentTitle"
FROM items i
JOIN spaces s ON s.id = i."spaceId"
LEFT JOIN communities c ON c.id = s."communityId"
LEFT JOIN items p ON p.id = i."parentId"
LEFT JOIN items gp ON gp.id = p."parentId"
`;

function toItem(r: RawItem): DuplicateItem {
  const ancestors: Ancestor[] = [];
  if (r.grandparentId && r.grandparentTitle) {
    ancestors.push({ id: r.grandparentId, title: r.grandparentTitle });
  }
  if (r.parentId && r.parentTitle) {
    ancestors.push({ id: r.parentId, title: r.parentTitle });
  }
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    status: r.status,
    priority: r.priority,
    createdAt: r.createdAt,
    spaceId: r.spaceId,
    spaceName: r.spaceName,
    communityId: r.communityId,
    communityName: r.communityName,
    ancestors,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

export const adminDuplicatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  // GET /admin/duplicates
  fastify.get('/', async () => {
    const prisma = fastify.prisma;
    const groups: DuplicateGroup[] = [];

    // ── 1. Duplicate titles (all types) ──────────────────────────────
    const titleKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT LOWER(TRIM(REGEXP_REPLACE(title, '\\s+', ' ', 'g'))) as key
      FROM items
      GROUP BY key
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (titleKeys.length > 0) {
      const placeholders = titleKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = titleKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<RawItem[]>(
        `SELECT ${ITEM_SELECT}
         WHERE LOWER(TRIM(REGEXP_REPLACE(i.title, '\\s+', ' ', 'g'))) IN (${placeholders})
         ORDER BY LOWER(TRIM(REGEXP_REPLACE(i.title, '\\s+', ' ', 'g'))), i."createdAt"`,
        ...keys
      );
      const grouped = groupBy(items, (r) =>
        r.title.toLowerCase().trim().replace(/\s+/g, ' ')
      );
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'title', items: groupItems.map(toItem) });
      }
    }

    // ── 2. Duplicate URLs (LINK type) ─────────────────────────────────
    const urlKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT url as key
      FROM items
      WHERE type = 'LINK' AND url IS NOT NULL AND url <> ''
      GROUP BY url
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (urlKeys.length > 0) {
      const placeholders = urlKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = urlKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<RawItem[]>(
        `SELECT ${ITEM_SELECT}
         WHERE i.type = 'LINK' AND i.url IN (${placeholders})
         ORDER BY i.url, i."createdAt"`,
        ...keys
      );
      const grouped = groupBy(items, (r) => r.url ?? '');
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'url', items: groupItems.map(toItem) });
      }
    }

    // ── 3. Duplicate filenames (IMAGE / DOCUMENT) ─────────────────────
    const fileKeys = await prisma.$queryRawUnsafe<{ key: string }[]>(`
      SELECT REGEXP_REPLACE(url, '^.+/', '') as key
      FROM items
      WHERE type IN ('IMAGE', 'DOCUMENT') AND url IS NOT NULL AND url <> ''
      GROUP BY key
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (fileKeys.length > 0) {
      const placeholders = fileKeys.map((_, i) => `$${i + 1}`).join(', ');
      const keys = fileKeys.map((r) => r.key);
      const items = await prisma.$queryRawUnsafe<RawItem[]>(
        `SELECT ${ITEM_SELECT}
         WHERE i.type IN ('IMAGE', 'DOCUMENT')
           AND REGEXP_REPLACE(i.url, '^.+/', '') IN (${placeholders})
         ORDER BY REGEXP_REPLACE(i.url, '^.+/', ''), i."createdAt"`,
        ...keys
      );
      const grouped = groupBy(items, (r) =>
        (r.url ?? '').replace(/^.+\//, '')
      );
      for (const [key, groupItems] of grouped) {
        groups.push({ key, reason: 'filename', items: groupItems.map(toItem) });
      }
    }

    return { groups, total: groups.reduce((n, g) => n + g.items.length, 0) };
  });
};
```

- [ ] **Step 2: Verify the file compiles (typecheck)**

```bash
cd C:/_dev/spok && pnpm typecheck 2>&1 | grep -i "duplicates\|error" | head -20
```

Expected: no errors mentioning `duplicates.ts`.

---

## Task 2 — Register route + API client

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Register the route in `apps/api/src/index.ts`**

Add import at the top with the other admin imports (around line 15–26):
```typescript
import { adminDuplicatesRoutes } from './routes/admin/duplicates.js';
```

Add registration after line 272 (after `adminPerfRoutes`):
```typescript
await app.register(adminDuplicatesRoutes, { prefix: '/admin/duplicates' });
```

- [ ] **Step 2: Add API client in `apps/web/src/lib/api.ts`**

In `adminApi` object (after the `anomalies` section, around line 1524), add:
```typescript
  duplicates: {
    list: () =>
      fetchApi<{
        groups: Array<{
          key: string;
          reason: 'title' | 'url' | 'filename';
          items: Array<{
            id: string;
            title: string;
            type: string;
            url: string | null;
            status: string | null;
            priority: number | null;
            createdAt: string;
            spaceId: string;
            spaceName: string;
            communityId: string | null;
            communityName: string | null;
            ancestors: Array<{ id: string; title: string }>;
          }>;
        }>;
        total: number;
      }>('/admin/duplicates'),
  },
```

- [ ] **Step 3: Verify typecheck**

```bash
cd C:/_dev/spok && pnpm typecheck 2>&1 | grep -i "error" | head -10
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git -C "C:/_dev/spok" add apps/api/src/routes/admin/duplicates.ts apps/api/src/index.ts apps/web/src/lib/api.ts
git -C "C:/_dev/spok" commit -m "feat(admin): endpoint GET /admin/duplicates + API client"
```

---

## Task 3 — Frontend: `DuplicatesPage.tsx`

**Files:**
- Create: `apps/web/src/pages/admin/DuplicatesPage.tsx`

- [ ] **Step 1: Create the page**

```typescript
// apps/web/src/pages/admin/DuplicatesPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Copy, ExternalLink, FolderKanban, ChevronRight, AlertCircle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { getTypeIcon } from '../../constants/ui';

type Reason = 'title' | 'url' | 'filename';

const REASON_CONFIG: Record<Reason, { label: string; color: string; bg: string }> = {
  title:    { label: 'Titre',   color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  url:      { label: 'URL',     color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30' },
  filename: { label: 'Fichier', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
};

type FilterTab = 'all' | Reason;

type DuplicateItem = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  spaceId: string;
  spaceName: string;
  communityName: string | null;
  ancestors: Array<{ id: string; title: string }>;
};

// Breadcrumb: Communauté > Espace > Grand-parent > Parent
function Breadcrumb({ item }: { item: DuplicateItem }) {
  const parts: string[] = [];
  if (item.communityName) parts.push(item.communityName);
  parts.push(item.spaceName);
  for (const a of item.ancestors) parts.push(a.title);

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />}
          <span className={`text-[10px] truncate max-w-[80px] ${i === parts.length - 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`} title={part}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

export function DuplicatesPage() {
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'duplicates'],
    queryFn: () => adminApi.duplicates.list(),
  });

  const groups = data?.groups ?? [];
  const filtered = filter === 'all' ? groups : groups.filter((g) => g.reason === filter);
  const countByReason = (r: Reason) => groups.filter((g) => g.reason === r).length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',      label: 'Tous',    count: groups.length },
    { key: 'title',    label: 'Titre',   count: countByReason('title') },
    { key: 'url',      label: 'URL',     count: countByReason('url') },
    { key: 'filename', label: 'Fichier', count: countByReason('filename') },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Copy className="w-6 h-6 text-orange-500" />
            Doublons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items avec titre, URL ou nom de fichier identique sur tous les espaces
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              filter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-mono ${
                filter === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Analyse en cours…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Aucun doublon détecté</p>
          <p className="text-sm mt-1">
            {filter === 'all'
              ? 'Tous les items sont uniques.'
              : `Aucun doublon par ${REASON_CONFIG[filter as Reason].label.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((group, idx) => {
            const cfg = REASON_CONFIG[group.reason];
            return (
              <div key={`${group.reason}-${idx}`} className="border border-border rounded-lg overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm font-medium truncate flex-1" title={group.key}>
                    {group.key || <span className="italic text-muted-foreground">(vide)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {group.items.length} items
                  </span>
                </div>

                {/* Cards row */}
                <div className="flex gap-3 p-4 overflow-x-auto">
                  {group.items.map((item) => {
                    const Icon = getTypeIcon(item.type, item.url ?? undefined);
                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-60 bg-card border border-border rounded-lg p-3 flex flex-col gap-2 hover:border-primary/50 transition-colors"
                      >
                        {/* Type + title */}
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          <span className="text-sm font-medium leading-tight line-clamp-2 flex-1">
                            {item.title}
                          </span>
                        </div>

                        {/* Status */}
                        {item.status && (
                          <span className="text-xs text-muted-foreground/80 truncate">{item.status}</span>
                        )}

                        {/* Breadcrumb: Communauté > Espace > ancêtres */}
                        <div className="mt-auto pt-2 border-t border-border/50">
                          <Breadcrumb item={item} />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <Link
                            to={`/spaces/${item.spaceId}?item=${item.id}`}
                            className="flex-1 text-xs text-center px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                          >
                            Ouvrir
                          </Link>
                          <Link
                            to={`/spaces/${item.spaceId}?item=${item.id}`}
                            target="_blank"
                            className="p-1 rounded border border-border hover:bg-accent transition-colors"
                            title="Ouvrir dans un nouvel onglet"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd C:/_dev/spok && pnpm typecheck 2>&1 | grep -i "error" | head -10
```

Expected: no errors mentioning `DuplicatesPage`.

---

## Task 4 — Wiring: route, menu item

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `packages/shared/src/constants/menuDefaults.ts`

- [ ] **Step 1: Add import in `apps/web/src/App.tsx`**

With the other admin imports (around line 24–34):
```typescript
import { DuplicatesPage } from './pages/admin/DuplicatesPage';
```

- [ ] **Step 2: Add preload hint (same block as other admin pages, around line 103–112)**

```typescript
  [/^\/admin\/duplicates$/, 'pages/admin/DuplicatesPage.tsx'],
```

- [ ] **Step 3: Add route in App.tsx (after the other admin routes, around line 205)**

```typescript
<Route path="admin/duplicates" element={<AdminRoute><DuplicatesPage /></AdminRoute>} />
```

- [ ] **Step 4: Add menu item in `packages/shared/src/constants/menuDefaults.ts`**

In the `// ── Section: admin ──` block, after the `admin-anomalies` entry (line 63), add:
```typescript
  { id: '', key: 'admin-duplicates', label: 'Doublons', icon: 'Copy', section: 'admin', sectionLabel: 'Administration', sectionOrder: 8, route: '/admin/duplicates', viewMode: null, order: 6, visible: true, access: 'admin' },
```

Bump the `order` of the three entries that follow:
- `admin-menu`: 6 → 7
- `admin-referentiels`: 7 → 8
- `admin-api-doc`: 8 → 9

- [ ] **Step 5: Rebuild shared package (menu constants change)**

```bash
cd C:/_dev/spok && pnpm build:packages
```

Expected: build succeeds.

- [ ] **Step 6: Verify typecheck**

```bash
cd C:/_dev/spok && pnpm typecheck 2>&1 | grep -i "error" | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git -C "C:/_dev/spok" add apps/web/src/pages/admin/DuplicatesPage.tsx apps/web/src/App.tsx packages/shared/src/constants/menuDefaults.ts
git -C "C:/_dev/spok" commit -m "feat(admin): page Doublons — détection par titre normalisé, URL, nom de fichier"
```

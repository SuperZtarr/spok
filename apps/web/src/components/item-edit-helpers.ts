/* Helpers d'ItemEditModal : payloads, diff des champs modifiés, fusion formulaire/serveur (mergeFormWithServer), résumé Forum (buildForumSummary). */
import type { Item, ItemTemplateNode } from '@spok/shared';

/** Extract a clean name from a filename (remove extension) */
export function fileNameToTitle(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '');
  return name.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract a readable title from a URL (domain or last path segment) */
export function urlToTitle(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname.replace(/\/$/, '');
    if (path && path !== '/') {
      const last = path.split('/').pop() || '';
      const decoded = decodeURIComponent(last).replace(/\.[^.]+$/, '');
      if (decoded) return decoded.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Capture récursivement un item et ses descendants en structure de modèle (titre+type). */
export function buildItemTemplateStructure(id: string, allItems: Item[]): ItemTemplateNode {
  const item = allItems.find((i) => i.id === id);
  const children = allItems
    .filter((i) => i.parentId === id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((child) => buildItemTemplateStructure(child.id, allItems));
  return { title: item?.title ?? '', type: (item?.type ?? 'NOTE') as ItemTemplateNode['type'], children };
}

/** Compte le nombre total de nœuds (racine incluse) d'une structure de modèle. */
export function countTemplateNodes(node: ItemTemplateNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTemplateNodes(child), 0);
}

/** Get all descendants of an item to prevent circular references */
export function getDescendantIds(id: string, allItems: Item[]): Set<string> {
  const descendants = new Set<string>();
  const findDescendants = (currentId: string) => {
    allItems.forEach((item) => {
      if (item.parentId === currentId && !descendants.has(item.id)) {
        descendants.add(item.id);
        findDescendants(item.id);
      }
    });
  };
  findDescendants(id);
  return descendants;
}

/**
 * Resynchronisation du formulaire d'ItemEditModal quand une version plus récente de l'item arrive
 * (refetch à l'ouverture après une modif faite dans une vue, absorption, cascade…).
 * Fusion champ par champ : un champ modifié par l'utilisateur (≠ `base`, la version qui a rempli le
 * formulaire) garde sa saisie ; les autres prennent la valeur serveur `next`. Sans `base` (premier
 * chargement de cet item) : tout vient de `next`. Valeurs comparées par égalité stricte — passer des
 * scalaires (tags : clé triée jointe, cf. tagKey).
 */
export function mergeFormWithServer<T extends Record<string, unknown>>(current: T, base: T | null, next: T): T {
  if (!base) return { ...next };
  const merged = { ...next };
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (current[key] !== base[key]) merged[key] = current[key];
  }
  return merged;
}

/** Clé scalaire d'un ensemble d'ids de tags (ordre indifférent), pour mergeFormWithServer. */
export function tagKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

/**
 * Résumé des champs avancés renseignés, affiché sous le titre de la modale Forum réduite
 * (ex. « Tâche · En cours · Haute · échéance 3 oct. · Alice · 2 liens »). Remplace le dépliage
 * automatique : la modale Forum reste réduite, rien n'est caché. Vide pour une Note vierge.
 * Ordre : type (hors Note/Non défini), statut (hors non défini), priorité, période ou début,
 * échéance, assigné, nombre de liens. Libellés injectés (référentiels, PRIORITIES, format de date).
 */
export function buildForumSummary(
  item: {
    type?: string | null; status?: string | null; priority?: number | null;
    startDate?: string | null; endDate?: string | null; dueDate?: string | null;
    assignedTo?: { name?: string | null } | null;
    relationsFrom?: unknown[] | null; relationsTo?: unknown[] | null;
  },
  labels: {
    typeLabel: (type: string) => string | undefined;
    statusLabel: (status: string) => string | undefined;
    priorityLabel: (priority: number) => string | undefined;
    formatDate: (iso: string) => string;
  },
): string[] {
  const parts: string[] = [];
  if (item.type && item.type !== 'NOTE' && item.type !== 'UNDEFINED') parts.push(labels.typeLabel(item.type) ?? item.type);
  if (item.status && item.status !== 'undefined') parts.push(labels.statusLabel(item.status) ?? item.status);
  if (item.priority != null) parts.push(labels.priorityLabel(item.priority) ?? `P${item.priority}`);
  if (item.startDate && item.endDate) {
    const from = labels.formatDate(item.startDate);
    const to = labels.formatDate(item.endDate);
    parts.push(from === to ? from : `${from} → ${to}`); // réunion d'un jour : une seule date
  }
  else if (item.startDate) parts.push(`dès ${labels.formatDate(item.startDate)}`);
  if (item.dueDate) parts.push(`échéance ${labels.formatDate(item.dueDate)}`);
  if (item.assignedTo?.name) parts.push(item.assignedTo.name);
  const links = (item.relationsFrom?.length ?? 0) + (item.relationsTo?.length ?? 0);
  if (links > 0) parts.push(`${links} lien${links > 1 ? 's' : ''}`);
  return parts;
}

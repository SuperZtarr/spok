/*
 * Réunion des contenus (images, fichiers, liens, schémas) de plusieurs éléments sur un seul — lot 5 « contenus
 * multiples » (décision Thomas 2026-11-11). Sert la fusion (`/:id/merge`), son aperçu (`/:id/merge-preview`) et
 * « Absorber les enfants » (`/:id/absorb-children`) — item-merge.ts. Un seul calcul pour l'aperçu et l'écriture :
 * le chiffre annoncé dans la modale est celui qui sera appliqué.
 * Règle : l'élément gardé conserve ses contenus ; ceux des autres viennent à la suite, dans leur sorte (ordre fixe
 * Images, Fichiers, Liens, Schémas inchangé). Doublon (même sorte) gardé une fois, version de l'élément gardé :
 *  - lien : même adresse (schéma et domaine sans casse, « / » final ignoré) ;
 *  - image / fichier : même fichier stocké (url), ou même nom et même taille (même fichier envoyé deux fois) ;
 *  - schéma : même dessin (xml), à défaut même url.
 * Au-delà de ITEM_CONTENTS_MAX, la réunion est refusée (ContentMergeError) — vérifier AVANT toute autre écriture.
 * - planContentMerge : pur, sans base (tests).
 * - loadContentMergePlan : lit les contenus (xml compris) et calcule le plan.
 * - applyContentMergePlan : déplace les contenus retenus (itemId + position) et retire les doublons.
 * Fichiers : un contenu déplacé garde son url (fichier rangé sous items/<ancien id>/) ; le doublon retiré n'efface pas
 * son fichier — comme la suppression d'un élément, rien n'est effacé du stockage ici (pas de risque d'effacer un
 * fichier encore utilisé). Règle de gestion : item-contents-merge (lib/businessRules.ts côté web).
 */
import { ITEM_CONTENTS_MAX } from '@spok/shared';

export interface MergeableContent {
  id: string;
  itemId: string;
  kind: string;
  url: string | null;
  name: string | null;
  size: number | null;
  xml?: string | null;
  position: number;
}

export interface ContentMergePlan {
  keptCount: number;      // contenus de l'élément gardé
  incomingCount: number;  // contenus des éléments réunis
  duplicateIds: string[]; // contenus réunis retirés comme doublons
  moves: { id: string; position: number }[]; // contenus réunis déplacés, avec leur position dans leur sorte
  total: number;          // contenus de l'élément gardé après réunion
  max: number;
  tooMany: boolean;
}

export class ContentMergeError extends Error {
  constructor(public plan: ContentMergePlan) {
    super(`La réunion donnerait ${plan.total} contenus : un élément en porte au plus ${plan.max}. Retirez-en d'abord.`);
  }
}

/** Adresse de lien comparable : schéma et domaine sans casse, « / » final ignoré. */
export function normalizeLinkUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}${u.hash}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/** Clés d'identité d'un contenu : deux contenus partageant une clé sont des doublons. */
function identityKeys(c: MergeableContent): string[] {
  const keys: string[] = [];
  if (c.kind === 'LINK') {
    if (c.url) keys.push(`LINK|${normalizeLinkUrl(c.url)}`);
  } else if (c.kind === 'DIAGRAM') {
    if (c.xml) keys.push(`DIAGRAM|xml|${c.xml}`);
    else if (c.url) keys.push(`DIAGRAM|url|${c.url}`);
  } else {
    if (c.url) keys.push(`${c.kind}|url|${c.url}`);
    if (c.name && c.size != null) keys.push(`${c.kind}|ns|${c.name}|${c.size}`);
  }
  return keys;
}

/**
 * Plan de réunion : `kept` = contenus de l'élément gardé, `incoming` = contenus des autres, dans l'ordre où ils
 * doivent arriver (élément par élément, chacun dans son ordre). Pur.
 */
export function planContentMerge(kept: MergeableContent[], incoming: MergeableContent[]): ContentMergePlan {
  const seen = new Set<string>();
  const nextPos = new Map<string, number>();
  for (const c of kept) {
    identityKeys(c).forEach((k) => seen.add(k));
    nextPos.set(c.kind, Math.max(nextPos.get(c.kind) ?? 0, c.position + 1));
  }
  const duplicateIds: string[] = [];
  const moves: { id: string; position: number }[] = [];
  for (const c of incoming) {
    const keys = identityKeys(c);
    if (keys.some((k) => seen.has(k))) { duplicateIds.push(c.id); continue; }
    keys.forEach((k) => seen.add(k));
    const position = nextPos.get(c.kind) ?? 0;
    nextPos.set(c.kind, position + 1);
    moves.push({ id: c.id, position });
  }
  const total = kept.length + moves.length;
  return {
    keptCount: kept.length, incomingCount: incoming.length, duplicateIds, moves, total,
    max: ITEM_CONTENTS_MAX, tooMany: total > ITEM_CONTENTS_MAX,
  };
}

const CONTENT_SELECT = { id: true, itemId: true, kind: true, url: true, name: true, size: true, xml: true, position: true } as const;

/** Lit les contenus de l'élément gardé et des éléments réunis (dans l'ordre de `fromItemIds`), puis calcule le plan. */
export async function loadContentMergePlan(prisma: any, keptItemId: string, fromItemIds: string[]): Promise<ContentMergePlan> {
  const rows: MergeableContent[] = await prisma.itemContent.findMany({
    where: { itemId: { in: [keptItemId, ...fromItemIds] } },
    select: CONTENT_SELECT,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const kept = rows.filter((r) => r.itemId === keptItemId);
  const incoming = fromItemIds.flatMap((id) => rows.filter((r) => r.itemId === id));
  return planContentMerge(kept, incoming);
}

/** Applique le plan : contenus retenus rattachés à l'élément gardé, doublons retirés. */
export async function applyContentMergePlan(prisma: any, keptItemId: string, plan: ContentMergePlan): Promise<void> {
  if (plan.duplicateIds.length > 0) {
    await prisma.itemContent.deleteMany({ where: { id: { in: plan.duplicateIds } } });
  }
  for (const m of plan.moves) {
    await prisma.itemContent.update({ where: { id: m.id }, data: { itemId: keptItemId, position: m.position } });
  }
}

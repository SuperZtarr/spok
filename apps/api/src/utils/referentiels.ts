/*
 * Référentiels d'une communauté : les libellés de types et les statuts sont stockés tels quels (Community.referentiels)
 * au moment de la personnalisation. Un type ajouté depuis (ARTICLE 2026-10-23, QUESTION 2026-11-08) y serait absent →
 * invisible et non créable ; ses statuts réservés (issues d'une question) aussi.
 * withDefaultTypeLabels complète les types manquants avec DEFAULT_TYPE_LABELS, sans jamais toucher un type présent,
 * et les statuts réservés manquants (withDefaultStatuses, réservation rétablie, libellé/couleur personnalisés gardés).
 * Les types retirés du registre (Lien, Document, Image, Diagramme, Configuration, Anomalie — lot 4 contenus multiples)
 * sont écartés des libellés stockés : ils ne réapparaissent dans aucune colonne ni filtre.
 * À appliquer à toute LECTURE de référentiels personnalisés (routes referentiels.ts, community-referentiels.ts).
 * statusesOfSpaces(prisma, spaceIds) : statuts des communautés de ces espaces (défauts si aucune personnalisation),
 * pour lire le SENS d'un statut côté API (statusCategory, isClosedStatus, statusIdsIn de @spok/shared) — requêtes
 * « non terminés » (agenda, review-queue), date de fin automatique, statut posé à la création. Jamais de 'done' en dur.
 * Plusieurs communautés : union des statuts (le premier id rencontré l'emporte).
 */
import type { PrismaClient } from '@spok/database';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS, isItemType, withDefaultStatuses, type SpaceReferentiels, type StatusConfig } from '@spok/shared';

export function withDefaultTypeLabels(r: SpaceReferentiels): SpaceReferentiels {
  const kept = Object.fromEntries(Object.entries(r.typeLabels ?? {}).filter(([type]) => isItemType(type)));
  return { ...r, statuses: withDefaultStatuses(r.statuses), typeLabels: { ...DEFAULT_TYPE_LABELS, ...kept } };
}

function customStatuses(config: unknown): StatusConfig[] | null {
  const statuses = (config as { statuses?: unknown } | null)?.statuses;
  return Array.isArray(statuses) ? withDefaultStatuses(statuses as StatusConfig[]) : null;
}

export async function statusesOfSpaces(prisma: Pick<PrismaClient, 'space'>, spaceIds: string[]): Promise<StatusConfig[]> {
  if (spaceIds.length === 0) return DEFAULT_STATUSES;
  const spaces = (await prisma.space.findMany({
    where: { id: { in: spaceIds } },
    select: { community: { select: { referentiels: true } } },
  })) ?? [];
  const out = new Map<string, StatusConfig>();
  let usesDefaults = false;
  for (const sp of spaces) {
    const own = customStatuses(sp.community?.referentiels);
    if (!own) { usesDefaults = true; continue; }
    for (const s of own) if (!out.has(s.id)) out.set(s.id, s);
  }
  if (usesDefaults || out.size === 0) for (const s of DEFAULT_STATUSES) if (!out.has(s.id)) out.set(s.id, s);
  return [...out.values()];
}

export const statusesOfSpace = (prisma: Pick<PrismaClient, 'space'>, spaceId: string) => statusesOfSpaces(prisma, [spaceId]);

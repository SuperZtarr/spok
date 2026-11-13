/*
 * Cumul des références externes (« Outil : référence », table item_external_refs) de plusieurs éléments sur un seul —
 * règle item-external-refs (décision Thomas 2026-11-13). Sert la fusion (`/:id/merge`) et « Absorber les enfants »
 * (`/:id/absorb-children`) — item-merge.ts.
 * Règle : l'élément gardé conserve ses références, dans leur ordre ; celles des autres viennent à la suite (dans l'ordre
 * des ids donnés), doublons sans casse retirés (cleanExternalRefs de @spok/shared). Au-delà des limites
 * (externalRefsError : 20 entrées), la réunion est refusée — vérifier AVANT toute écriture (error non nul → 400).
 * - planExternalRefsMerge : pur, sans base (tests).
 * - loadExternalRefsMerge : lit les références et calcule le plan.
 * - applyExternalRefsMerge : réécrit la liste de l'élément gardé si elle change ; les références des autres éléments
 *   partent avec leur suppression (onDelete: Cascade) — ne rien supprimer ici.
 */
import { cleanExternalRefs, externalRefsError } from '@spok/shared';

export interface ExternalRefsMergePlan {
  keepId: string;
  values: string[];
  changed: boolean;
  error: string | null;
}

interface RefRow { itemId: string; value: string; position: number }

/** Plan de cumul : références de keepId puis celles de fromIds (dans cet ordre), sans doublon */
export function planExternalRefsMerge(keepId: string, fromIds: string[], rows: RefRow[]): ExternalRefsMergePlan {
  const of = (id: string) => rows.filter((r) => r.itemId === id).sort((a, b) => a.position - b.position).map((r) => r.value);
  const kept = of(keepId);
  const values = cleanExternalRefs([...kept, ...fromIds.flatMap(of)]);
  const changed = values.length !== kept.length || values.some((v, i) => v !== kept[i]);
  return { keepId, values, changed, error: changed ? externalRefsError(values) : null };
}

export async function loadExternalRefsMerge(prisma: any, keepId: string, fromIds: string[]): Promise<ExternalRefsMergePlan> {
  const rows: RefRow[] = await prisma.itemExternalRef.findMany({
    where: { itemId: { in: [keepId, ...fromIds] } },
    select: { itemId: true, value: true, position: true },
  });
  return planExternalRefsMerge(keepId, fromIds, rows ?? []);
}

export async function applyExternalRefsMerge(prisma: any, plan: ExternalRefsMergePlan): Promise<void> {
  if (!plan.changed) return;
  await prisma.itemExternalRef.deleteMany({ where: { itemId: plan.keepId } });
  if (plan.values.length) {
    await prisma.itemExternalRef.createMany({
      data: plan.values.map((value, position) => ({ itemId: plan.keepId, value, position })),
    });
  }
}

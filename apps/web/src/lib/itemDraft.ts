/*
 * Brouillon de la fiche d'un élément gardé dans le navigateur (règle item-draft-local, décision Thomas 2026-11-12) :
 * une saisie non enregistrée (champs de la fiche, contribution en cours) survit à une session expirée, une coupure
 * réseau, un onglet fermé ou une fiche refermée par la croix / Échap ; elle est proposée à la réouverture
 * (ItemDraftBanner). Clé par compte ET par élément (`spok-item-draft:<userId>:<itemId>`) : un autre compte du même
 * navigateur ne la voit pas. Expire au bout de DRAFT_TTL_MS (purgé à la lecture et par purgeExpiredItemDrafts).
 * Le stockage peut être absent ou refuser (navigation privée, quota) : chaque accès est protégé, l'échec ne fait
 * rien d'autre que ne pas garder le brouillon. La déconnexion ne vide que le jeton (stores/auth.ts) : ne pas y effacer
 * ces brouillons, c'est précisément le cas qu'ils couvrent.
 */

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PREFIX = 'spok-item-draft:';

/** Champs de la fiche, au format du formulaire d'ItemEditModal (dates en datetime-local) */
export interface ItemDraftFields {
  title: string;
  description: string;
  parentId: string;
  status: string;
  priority: number | null;
  assignedToId: string;
  assignedToName: string;
  type: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  tagIds: string[];
  /** Références externes en ligne « Appli : Réf | … » (absent d'un brouillon antérieur au champ) */
  externalRefs?: string;
}

export interface ItemDraftContribution {
  text: string;
  vote: string | null;
  replyTo: string | null;
}

export interface ItemDraft {
  savedAt: number;
  /** updatedAt de l'élément quand la saisie a commencé : plus ancien que l'actuel = modifié depuis par ailleurs */
  baseUpdatedAt: string | null;
  fields?: ItemDraftFields;
  contribution?: ItemDraftContribution;
}

const key = (userId: string, itemId: string) => `${PREFIX}${userId}:${itemId}`;

function storage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function saveItemDraft(userId: string, itemId: string, draft: ItemDraft): void {
  try { storage()?.setItem(key(userId, itemId), JSON.stringify(draft)); } catch { /* stockage refusé : rien gardé */ }
}

export function clearItemDraft(userId: string, itemId: string): void {
  try { storage()?.removeItem(key(userId, itemId)); } catch { /* rien à faire */ }
}

/** Brouillon encore valable, ou null (absent, illisible ou expiré — alors effacé) */
export function loadItemDraft(userId: string, itemId: string, now = Date.now()): ItemDraft | null {
  try {
    const raw = storage()?.getItem(key(userId, itemId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ItemDraft;
    if (typeof draft?.savedAt !== 'number' || now - draft.savedAt > DRAFT_TTL_MS || (!draft.fields && !draft.contribution)) {
      clearItemDraft(userId, itemId);
      return null;
    }
    return draft;
  } catch {
    clearItemDraft(userId, itemId);
    return null;
  }
}

/** Efface tous les brouillons expirés de ce navigateur (tous comptes) */
export function purgeExpiredItemDrafts(now = Date.now()): void {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      try {
        const d = JSON.parse(s.getItem(k) ?? '') as ItemDraft;
        if (typeof d?.savedAt !== 'number' || now - d.savedAt > DRAFT_TTL_MS) s.removeItem(k);
      } catch { s.removeItem(k); }
    }
  } catch { /* stockage inaccessible */ }
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

/** Le brouillon apporte-t-il quelque chose par rapport à l'élément enregistré ? (sinon inutile de le proposer) */
export function draftHasChanges(draft: ItemDraft, server: ItemDraftFields): boolean {
  if (draft.contribution && draft.contribution.text.replace(/<[^>]*>/g, '').trim()) return true;
  const f = draft.fields;
  if (!f) return false;
  return (Object.keys(server) as (keyof ItemDraftFields)[]).some((k) =>
    k === 'tagIds' ? !sameTags(f.tagIds ?? [], server.tagIds)
      : k === 'externalRefs' ? (f.externalRefs ?? server.externalRefs ?? '') !== (server.externalRefs ?? '')
      : (f[k] ?? null) !== (server[k] ?? null));
}

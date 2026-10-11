/*
 * Store de la séance live active (une par navigateur) : la fenêtre en direct et les actions
 * « Ajouter à la préparation » / « Présenter en séance » suivent l'utilisateur sur toutes les pages.
 * - spaceId : espace de la séance active — SEUL champ persisté (localStorage 'spok.activeLiveSession').
 * - info : statut/rôle synchronisés par LiveSessionHost depuis l'API (jamais persistés, revalidés au chargement).
 * Écrivains : SpacePage (setActive à l'ouverture d'un espace de séance), ParentSessionsButton (création/rejoindre),
 * LiveSessionHost (setInfo ; clear sur 403/404 ou « Quitter le direct »). Lire hors React via getState().
 * pendingAdd : question « ajouter aussi les sous-éléments ? » en attente (posée par requestAddToAgenda,
 * affichée par LiveSessionHost via AddChildrenDialog) — non persistée.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LiveSessionRoleType, LiveSessionStatus } from '@spok/shared';

export interface ActiveLiveInfo {
  sessionId: string;
  status: LiveSessionStatus;
  myRole: LiveSessionRoleType | 'PARTICIPANT';
  spaceName: string;
}

interface ActiveLiveSessionState {
  spaceId: string | null;
  info: ActiveLiveInfo | null;
  pendingAdd: { itemId: string; count: number } | null;
  setActive: (spaceId: string) => void;
  setInfo: (info: ActiveLiveInfo | null) => void;
  setPendingAdd: (pending: { itemId: string; count: number } | null) => void;
  clear: () => void;
}

export const useActiveLiveSessionStore = create<ActiveLiveSessionState>()(
  persist(
    (set, get) => ({
      spaceId: null,
      info: null,
      pendingAdd: null,
      setActive: (spaceId) => { if (get().spaceId !== spaceId) set({ spaceId, info: null }); },
      setInfo: (info) => set({ info }),
      setPendingAdd: (pendingAdd) => set({ pendingAdd }),
      clear: () => set({ spaceId: null, info: null, pendingAdd: null }),
    }),
    { name: 'spok.activeLiveSession', partialize: (s) => ({ spaceId: s.spaceId }) },
  ),
);

/** L'utilisateur peut-il afficher / préparer dans la séance active ? */
export const canPresent = (info: ActiveLiveInfo | null): info is ActiveLiveInfo =>
  !!info && info.myRole !== 'PARTICIPANT';

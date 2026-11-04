/*
 * Store de l'élément ouvert dans la fiche de SpacePage : son id et son espace, état volatil, non persisté.
 * Écrit par SpacePage seul, lu par Layout pour le titre de l'onglet. Existe parce que ?item= quitte l'adresse dès
 * l'ouverture et n'y figure jamais après un clic dans une vue : l'adresse ne dit pas quel élément est ouvert.
 */
import { create } from 'zustand';

interface OpenItemState {
  openItem: { spaceId: string; itemId: string } | null;
  setOpenItem: (openItem: { spaceId: string; itemId: string } | null) => void;
}

export const useOpenItemStore = create<OpenItemState>((set) => ({
  openItem: null,
  setOpenItem: (openItem) => set({ openItem }),
}));

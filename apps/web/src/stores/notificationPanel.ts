/*
 * Store du menu de la cloche de notifications : ouvert ou non — état volatil, non persisté.
 * Partagé pour que d'autres écrans puissent ouvrir la cloche (accueil, carte « Non lus » → « Voir tout ») :
 * il n'existe pas de page /notifications, la cloche est l'unique liste (spec SPOK « Notifications »).
 * Lu par NotificationBell (seul composant qui affiche le menu) ; ne pas y mettre la liste elle-même (React Query).
 */
import { create } from 'zustand';

interface NotificationPanelState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useNotificationPanelStore = create<NotificationPanelState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));

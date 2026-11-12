/*
 * Store du suivi de l'aide d'un compte, conservé côté serveur (GET/PATCH /user/help-state) : réponse au tutoriel d'accueil et
 * annonces traitées. Lu et écrit par help/announcements.ts, useOnboarding, NewFeatureOverlay, NewsCards et NewsPage.
 * load : chargé par Layout pour l'utilisateur connecté ; tant que `loaded` est faux, rien n'est annoncé, pour éviter de montrer
 * une annonce déjà traitée. clear : à la déconnexion, pour que le compte suivant ne reçoive pas ce suivi.
 * markHandled / unmarkHandled : modifient l'écran tout de suite, le serveur suit ; un échec d'enregistrement est silencieux
 * (l'annonce reviendrait à la prochaine visite, sans perte de données). markManyHandled : réponse au tutoriel d'accueil.
 * Publication (2026-11-12) : `overrides` = réglages de /admin/news (masquée, date), communs à tous ; load les charge avec le
 * suivi, loadOverrides seul pour /news sans connexion, setOverrides après un enregistrement admin. Un échec de lecture vaut
 * « aucun réglage » : les annonces du code s'affichent telles quelles. Appliqués par help/announcements.ts.
 * L'état des tours par vue et du clignotement du « ? » reste dans le navigateur (useOnboarding) : aucun suivi par vue en base.
 */
import { create } from 'zustand';
import { newsApi, userApi, type NewsOverride } from '../lib/api';

interface HelpAnnouncementsState {
  loaded: boolean;
  onboardingDone: boolean | null;
  handled: string[];
  overrides: NewsOverride[];
  overridesLoaded: boolean;
  load: () => Promise<void>;
  loadOverrides: () => Promise<void>;
  setOverrides: (overrides: NewsOverride[]) => void;
  clear: () => void;
  markHandled: (id: string) => void;
  unmarkHandled: (id: string) => void;
  /** Tutoriel d'accueil traité : les annonces déjà présentes comptent comme vues. */
  completeOnboarding: (presentIds: string[]) => void;
}

const save = (data: Parameters<typeof userApi.updateHelpState>[0]) => {
  userApi.updateHelpState(data).catch(() => {});
};

const fetchOverrides = () => newsApi.getOverrides().catch((): NewsOverride[] => []);

export const useHelpAnnouncementsStore = create<HelpAnnouncementsState>()((set, get) => ({
  loaded: false,
  onboardingDone: null,
  handled: [],
  overrides: [],
  overridesLoaded: false,
  load: async () => {
    try {
      const [{ onboardingDone, handled }, overrides] = await Promise.all([userApi.getHelpState(), fetchOverrides()]);
      set({ loaded: true, onboardingDone, handled, overrides, overridesLoaded: true });
    } catch {
      // Sans réponse du serveur : ni proposition ni annonce, plutôt que de les montrer à tort
    }
  },
  loadOverrides: async () => {
    if (get().overridesLoaded) return;
    const overrides = await fetchOverrides();
    set({ overrides, overridesLoaded: true });
  },
  setOverrides: (overrides) => set({ overrides, overridesLoaded: true }),
  clear: () => set({ loaded: false, onboardingDone: null, handled: [] }),
  markHandled: (id) => {
    if (get().handled.includes(id)) return;
    set((state) => ({ handled: [...state.handled, id] }));
    save({ add: [id] });
  },
  unmarkHandled: (id) => {
    set((state) => ({ handled: state.handled.filter((handledId) => handledId !== id) }));
    save({ remove: [id] });
  },
  completeOnboarding: (presentIds) => {
    set((state) => ({ onboardingDone: true, handled: [...new Set([...state.handled, ...presentIds])] }));
    save({ onboardingDone: true, add: presentIds });
  },
}));

/* Hook : bouton « Retour » d'une page de détail (paramètres de communauté, d'espace…) — revient à la page d'où l'on
   vient (historique de l'appli : liste d'administration, page de la communauté…) et, si la page a été ouverte
   directement (lien collé, nouvel onglet : aucune page précédente dans l'appli), mène à `fallback`.
   Param : fallback (route de repli, ex. la page de la communauté). Ne pas l'utiliser après une suppression : la page
   précédente peut ne plus exister — naviguer explicitement vers une route sûre. */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    // react-router (BrowserRouter) range l'index d'historique dans history.state.idx : 0 = première page de l'appli
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}

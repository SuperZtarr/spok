/*
 * SpaceUnavailable — écran de la page d'un espace quand l'espace ne peut pas être chargé (403/404, ou 401 d'un
 * visiteur sans session). Remplace barre d'outils et vue : avant, la page affichait un « Espace » vide (cas vécu :
 * session perdue dans un autre onglet, l'onglet restait sur un espace privé — 2026-10-28).
 * Props : anonymous (visiteur non connecté) → « Se connecter » (pose spok_last_location + spok_session_expired pour
 * que « Retourner à » ramène ici après connexion, mécanisme de l'expiration de session) ; sinon accès refusé / introuvable.
 * Textes : hints unavailable* de pages/help/spaces.help.ts.
 */
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from './ui/Button';
import { PAGE_HELP } from '../help/pageHelp';

export function SpaceUnavailable({ anonymous }: { anonymous: boolean }) {
  const navigate = useNavigate();
  const hints = PAGE_HELP.spaces.hints;

  const login = () => {
    sessionStorage.setItem('spok_last_location', JSON.stringify({ url: window.location.pathname + window.location.search, label: 'Espace' }));
    sessionStorage.setItem('spok_session_expired', 'true');
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full p-8 text-center" data-testid="space-unavailable">
      <Lock className="w-10 h-10 text-muted-foreground" />
      <p className="max-w-md text-sm text-muted-foreground">{anonymous ? hints?.unavailableAnonymous : hints?.unavailable}</p>
      <div className="flex gap-2">
        {anonymous && <Button type="button" onClick={login}>Se connecter</Button>}
        <Link to="/" className="inline-flex"><Button type="button" variant="bordered" tabIndex={-1}>Accueil</Button></Link>
      </div>
    </div>
  );
}

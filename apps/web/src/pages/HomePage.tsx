/* Accueil connecté (/) : rend HomeView (onglets communautés/espaces/visualisations selon dashboardTab). */
import { HomeView } from '../components/views/HomeView';
import { LandingPage } from './LandingPage';
import { useAuthStore } from '../stores/auth';

export function HomePage() {
  const user = useAuthStore(s => s.user);
  if (!user) return <LandingPage />;
  return <HomeView />;
}

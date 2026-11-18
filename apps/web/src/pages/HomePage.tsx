/* Accueil connecté (/) : rend HomeView ; visiteur anonyme : LandingPage. (L'ancien store dashboardTab est supprimé, 2026-11-18.) */
import { HomeView } from '../components/views/HomeView';
import { LandingPage } from './LandingPage';
import { useAuthStore } from '../stores/auth';

export function HomePage() {
  const user = useAuthStore(s => s.user);
  if (!user) return <LandingPage />;
  return <HomeView />;
}

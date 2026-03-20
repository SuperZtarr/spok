import { Navigate } from 'react-router-dom';
import { useCommunityStore } from '../stores/community';
import { DashboardPage } from './DashboardPage';

export function SpacesListPage() {
  const { currentCommunity } = useCommunityStore();

  if (!currentCommunity) {
    return <Navigate to="/communities" replace />;
  }

  return <DashboardPage />;
}

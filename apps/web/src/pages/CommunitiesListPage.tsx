/* Liste des communautés (/communities) : les miennes + publiques à rejoindre + invitations en attente. */
import { useRef } from 'react';
import { CommunityListView } from '../components/views/CommunityListView';
import type { CommunityListViewHandle } from '../components/views/CommunityListView';
import { Button } from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { PageHelpButton } from '../help/PageHelpButton';

export function CommunitiesListPage() {
  const ref = useRef<CommunityListViewHandle>(null);
  const user = useAuthStore(s => s.user);

  return (
    <div className="flex flex-col h-full">
      {user && (
        <div className="flex items-center justify-end gap-2 px-4 py-2">
          <Button size="sm" data-tour="communities-new" onClick={() => ref.current?.openCreate()}>
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle communauté
          </Button>
          <PageHelpButton pageKey="communities" />
        </div>
      )}
      <CommunityListView ref={ref} />
    </div>
  );
}

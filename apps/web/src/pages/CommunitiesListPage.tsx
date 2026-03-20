import { useRef } from 'react';
import { CommunityListView } from '../components/views/CommunityListView';
import type { CommunityListViewHandle } from '../components/views/CommunityListView';
import { Button } from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

export function CommunitiesListPage() {
  const ref = useRef<CommunityListViewHandle>(null);
  const user = useAuthStore(s => s.user);

  return (
    <div className="flex flex-col h-full">
      {user && (
        <div className="flex items-center justify-end px-4 py-2">
          <Button size="sm" onClick={() => ref.current?.openCreate()}>
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle communaute
          </Button>
        </div>
      )}
      <CommunityListView ref={ref} />
    </div>
  );
}

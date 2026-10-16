/* Liste des communautés (/communities) : les miennes + publiques à rejoindre + invitations en attente.
   ?new=community : ouvre la modale de création à l'arrivée (lien « Créer une communauté » de l'accueil),
   puis retire le paramètre pour qu'un rechargement ne la rouvre pas. */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommunityListView } from '../components/views/CommunityListView';
import type { CommunityListViewHandle } from '../components/views/CommunityListView';
import { Button } from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { PageHelpButton } from '../help/PageHelpButton';

export function CommunitiesListPage() {
  const ref = useRef<CommunityListViewHandle>(null);
  const user = useAuthStore(s => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') !== 'community' || !user) return;
    ref.current?.openCreate();
    setSearchParams((p) => { p.delete('new'); return p; }, { replace: true });
  }, [searchParams, setSearchParams, user]);

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

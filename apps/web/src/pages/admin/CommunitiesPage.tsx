import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Building2, Users, FolderKanban, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CommunityDetailModal } from '../../components/admin/CommunityDetailModal';
import { CommunityDeleteConfirmModal } from '../../components/CommunityDeleteConfirmModal';
import { useSort } from '../../hooks/useSort';

interface AdminCommunity {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  spaceCount: number;
}

const accessors: Record<string, (c: AdminCommunity) => string | number> = {
  name: (c) => c.name?.toLowerCase() ?? '',
  members: (c) => c.memberCount,
  spaces: (c) => c.spaceCount,
  createdAt: (c) => c.createdAt,
};

export function CommunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalCommunityId, setModalCommunityId] = useState<string | null | undefined>(undefined);
  // undefined = modal fermé, null = création, string = édition

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminCommunity>('name', 'asc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'communities', { page, search }],
    queryFn: () => adminApi.communities.list({ page, pageSize: 20, search: search || undefined }),
  });

  const [communityToDelete, setCommunityToDelete] = useState<AdminCommunity | null>(null);

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      adminApi.communities.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setCommunityToDelete(null);
    },
  });

  const handleDelete = (community: AdminCommunity) => {
    setCommunityToDelete(community);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const sortedCommunities = useMemo(
    () => sortData(data?.data || [], accessors),
    [data, sortData]
  );

  const SortHeader = ({ label, column }: { label: string; column: string }) => (
    <th
      className="px-4 py-3 text-left text-sm font-medium cursor-pointer select-none hover:bg-muted/80"
      onClick={() => toggle(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === column && (
          sortOrder === 'asc'
            ? <ArrowUp className="w-3.5 h-3.5" />
            : <ArrowDown className="w-3.5 h-3.5" />
        )}
      </span>
    </th>
  );

  return (
    <div className="p-6">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Communautes</h1>
          <Button onClick={() => setModalCommunityId(null)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle communaute
          </Button>
        </div>

        <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom..."
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="secondary">
              Rechercher
            </Button>
          </div>
        </form>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <SortHeader label="Nom" column="name" />
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Visibilité</th>
                  <SortHeader label="Membres" column="members" />
                  <SortHeader label="Espaces" column="spaces" />
                  <SortHeader label="Date creation" column="createdAt" />
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedCommunities.map((community) => (
                  <tr key={community.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setModalCommunityId(community.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {community.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {community.description || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        community.isPublic
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {community.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {community.isPublic ? 'Publique' : 'Privée'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{community.memberCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        <span>{community.spaceCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(community.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(community); }}
                          disabled={deleteMutation.isPending}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedCommunities.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Aucune communaute trouvee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {data.pagination.total} communaute(s) au total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Precedent
                </Button>
                <span className="text-sm">
                  Page {page} sur {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {modalCommunityId !== undefined && (
        <CommunityDetailModal
          communityId={modalCommunityId}
          onClose={() => setModalCommunityId(undefined)}
        />
      )}

      {communityToDelete && (
        <CommunityDeleteConfirmModal
          isOpen={!!communityToDelete}
          onClose={() => setCommunityToDelete(null)}
          onConfirm={(deleteChildren) => {
            deleteMutation.mutate({ id: communityToDelete.id, deleteChildren });
          }}
          communityId={communityToDelete.id}
          communityName={communityToDelete.name}
          isPending={deleteMutation.isPending}
          isAdmin
        />
      )}
    </div>
  );
}

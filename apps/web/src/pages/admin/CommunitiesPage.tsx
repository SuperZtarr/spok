import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Building2, Users, FolderKanban, ArrowUp, ArrowDown, Eye, EyeOff, Clock, Check, X } from 'lucide-react';
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
  pendingPublic?: boolean;
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

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.communities.approvePublic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.communities.rejectPublic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
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

      {/* Pending public approval banner */}
      {sortedCommunities.filter(c => c.pendingPublic).length > 0 && (
        <div className="mb-6 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" />
            En attente d'approbation ({sortedCommunities.filter(c => c.pendingPublic).length})
          </h2>
          <div className="space-y-2">
            {sortedCommunities.filter(c => c.pendingPublic).map(community => (
              <div key={community.id} className="flex items-center justify-between bg-background/80 rounded-md px-4 py-2">
                <div>
                  <span className="font-medium">{community.name}</span>
                  {community.description && (
                    <span className="text-sm text-muted-foreground ml-2">— {community.description}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    {community.memberCount} membre{community.memberCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approveMutation.mutate(community.id)}
                    disabled={approveMutation.isPending}
                    title="Approuver la publication"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approuver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectMutation.mutate(community.id)}
                    disabled={rejectMutation.isPending}
                    title="Rejeter la demande"
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full">
              <thead className="bg-muted sticky top-0 z-10">
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
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          community.isPublic
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {community.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {community.isPublic ? 'Publique' : 'Privée'}
                        </span>
                        {community.pendingPublic && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            En attente
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end gap-1">
                        {community.pendingPublic && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); approveMutation.mutate(community.id); }}
                              disabled={approveMutation.isPending}
                              title="Approuver la publication"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(community.id); }}
                              disabled={rejectMutation.isPending}
                              title="Rejeter la demande"
                            >
                              <X className="w-4 h-4 text-amber-600" />
                            </Button>
                          </>
                        )}
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

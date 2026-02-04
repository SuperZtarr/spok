import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Building2, Users, FolderKanban, Eye } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CommunityFormModal } from '../../components/admin/CommunityFormModal';
import { CommunityDetailModal } from '../../components/admin/CommunityDetailModal';
import type { CreateCommunityInput, UpdateCommunityInput } from '@spok/shared';

interface AdminCommunity {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  spaceCount: number;
}

export function CommunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<AdminCommunity | null>(null);
  const [viewingCommunityId, setViewingCommunityId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'communities', { page, search }],
    queryFn: () => adminApi.communities.list({ page, pageSize: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCommunityInput & { ownerEmail?: string }) => adminApi.communities.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCommunityInput }) =>
      adminApi.communities.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setIsModalOpen(false);
      setEditingCommunity(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.communities.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const handleCreate = () => {
    setEditingCommunity(null);
    setIsModalOpen(true);
  };

  const handleEdit = (community: AdminCommunity) => {
    setEditingCommunity(community);
    setIsModalOpen(true);
  };

  const handleDelete = async (community: AdminCommunity) => {
    if (confirm(`Supprimer la communaute "${community.name}" ? Les espaces associes perdront leur lien avec cette communaute.`)) {
      deleteMutation.mutate(community.id);
    }
  };

  const handleSubmit = (data: (CreateCommunityInput & { ownerEmail?: string }) | UpdateCommunityInput) => {
    if (editingCommunity) {
      updateMutation.mutate({ id: editingCommunity.id, data });
    } else {
      createMutation.mutate(data as CreateCommunityInput & { ownerEmail?: string });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Communautes</h1>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle communaute
        </Button>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Membres</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Espaces</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date creation</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.data.map((community) => (
                  <tr key={community.id} className="hover:bg-muted/50">
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
                          onClick={() => setViewingCommunityId(community.id)}
                          title="Voir les details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(community)}
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(community)}
                          disabled={deleteMutation.isPending}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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

      <CommunityFormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCommunity(null);
        }}
        onSubmit={handleSubmit}
        community={editingCommunity}
        isLoading={createMutation.isPending || updateMutation.isPending}
        error={createMutation.error?.message || updateMutation.error?.message}
      />

      {viewingCommunityId && (
        <CommunityDetailModal
          communityId={viewingCommunityId}
          onClose={() => setViewingCommunityId(null)}
        />
      )}
    </div>
  );
}

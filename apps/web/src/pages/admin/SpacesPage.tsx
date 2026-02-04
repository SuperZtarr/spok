import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2, Users, FolderKanban, User, Building2 } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SpaceDetailModal } from '../../components/admin/SpaceDetailModal';

type SpaceType = 'PERSONAL' | 'GROUP' | '';

export function SpacesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<SpaceType>('');
  const [page, setPage] = useState(1);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spaces', { page, search, type: typeFilter }],
    queryFn: () =>
      adminApi.spaces.list({
        page,
        pageSize: 20,
        search: search || undefined,
        type: typeFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.spaces.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
    },
  });

  const handleDelete = async (space: { id: string; name: string; type: string }) => {
    const message =
      space.type === 'PERSONAL'
        ? `Attention: Supprimer l'espace personnel "${space.name}" ? Cette action est irreversible et supprimera tous les elements de cet espace.`
        : `Supprimer l'espace "${space.name}" ? Cette action est irreversible.`;

    if (confirm(message)) {
      deleteMutation.mutate(space.id);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const typeOptions = [
    { value: '', label: 'Tous les types' },
    { value: 'PERSONAL', label: 'Personnel' },
    { value: 'GROUP', label: 'Groupe' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Espaces de travail</h1>
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
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as SpaceType);
              setPage(1);
            }}
            options={typeOptions}
            className="w-48"
          />
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
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Communauté</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Proprietaire</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Membres</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Elements</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date creation</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.data.map((space) => (
                  <tr key={space.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        {space.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          space.type === 'PERSONAL'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {space.type === 'PERSONAL' ? (
                          <>
                            <User className="w-3 h-3" />
                            Personnel
                          </>
                        ) : (
                          <>
                            <Users className="w-3 h-3" />
                            Groupe
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {space.community ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Building2 className="w-3 h-3" />
                          {space.community.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {space.owner ? (
                        <span title={space.owner.email}>{space.owner.name}</span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{space.memberCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{space.itemCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(space.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSpaceId(space.id)}
                          title="Voir les details"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(space)}
                          disabled={deleteMutation.isPending}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {data.pagination.total} espace(s) au total
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

      {selectedSpaceId && (
        <SpaceDetailModal
          spaceId={selectedSpaceId}
          onClose={() => setSelectedSpaceId(null)}
        />
      )}
    </div>
  );
}

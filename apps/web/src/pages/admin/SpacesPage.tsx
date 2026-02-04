import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Users, FolderKanban, User, Building2, Eye } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SpaceDetailModal } from '../../components/admin/SpaceDetailModal';

interface AdminSpace {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  memberCount: number;
  itemCount: number;
  owner: { id: string; name: string; email: string } | null;
  community: { id: string; name: string } | null;
}

export function SpacesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spaces', { page, search }],
    queryFn: () =>
      adminApi.spaces.list({
        page,
        pageSize: 100, // Charger plus pour pouvoir grouper
        search: search || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.spaces.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
    },
  });

  const handleDelete = async (space: AdminSpace) => {
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

  // Séparer les espaces par type
  const groupSpaces = data?.data.filter((s) => s.type === 'GROUP') || [];
  const personalSpaces = data?.data.filter((s) => s.type === 'PERSONAL') || [];

  const SpaceTable = ({ spaces, showCommunity = false }: { spaces: AdminSpace[]; showCommunity?: boolean }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Nom</th>
            {showCommunity && (
              <th className="px-4 py-3 text-left text-sm font-medium">Communaute</th>
            )}
            <th className="px-4 py-3 text-left text-sm font-medium">Proprietaire</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Membres</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Elements</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Date creation</th>
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {spaces.map((space) => (
            <tr key={space.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-muted-foreground" />
                  {space.name}
                </div>
              </td>
              {showCommunity && (
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
              )}
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
                    <Eye className="w-4 h-4" />
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
          {spaces.length === 0 && (
            <tr>
              <td colSpan={showCommunity ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                Aucun espace trouve
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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
          <Button type="submit" variant="secondary">
            Rechercher
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <div className="space-y-8">
          {/* Espaces de groupe */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Espaces de groupe
              <span className="text-sm font-normal text-muted-foreground">
                ({groupSpaces.length})
              </span>
            </h2>
            <SpaceTable spaces={groupSpaces} showCommunity={true} />
          </div>

          {/* Espaces personnels */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Espaces personnels
              <span className="text-sm font-normal text-muted-foreground">
                ({personalSpaces.length})
              </span>
            </h2>
            <SpaceTable spaces={personalSpaces} showCommunity={false} />
          </div>

          {data && (
            <p className="text-sm text-muted-foreground text-center">
              {data.pagination.total} espace(s) au total
            </p>
          )}
        </div>
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

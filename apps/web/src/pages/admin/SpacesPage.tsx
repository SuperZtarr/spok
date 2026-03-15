import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Trash2, Users, FolderKanban, User, Building2, ArrowUp, ArrowDown, X, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SpaceDetailModal } from '../../components/admin/SpaceDetailModal';
import { SpaceDeleteConfirmModal } from '../../components/SpaceDeleteConfirmModal';
import { useSort } from '../../hooks/useSort';

const anomalyLabels: Record<string, string> = {
  'no-owner': 'Espaces sans proprietaire (OWNER)',
  'no-community': 'Espaces GROUP sans communaute',
  'multi-member-personal': 'Espaces personnels avec plusieurs membres',
};

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

const accessors: Record<string, (s: AdminSpace) => string | number> = {
  name: (s) => s.name?.toLowerCase() ?? '',
  owner: (s) => s.owner?.name?.toLowerCase() ?? '\uffff',
  community: (s) => s.community?.name?.toLowerCase() ?? '\uffff',
  members: (s) => s.memberCount,
  items: (s) => s.itemCount,
  createdAt: (s) => s.createdAt,
};

export function SpacesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const anomaly = searchParams.get('anomaly') || undefined;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminSpace>('name', 'asc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spaces', { page, search, anomaly }],
    queryFn: () =>
      adminApi.spaces.list({
        page,
        pageSize: 1000,
        search: search || undefined,
        anomaly,
      }),
  });

  const clearAnomaly = () => {
    setSearchParams({});
  };

  const [spaceToDelete, setSpaceToDelete] = useState<AdminSpace | null>(null);

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      adminApi.spaces.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      setSpaceToDelete(null);
    },
  });

  const handleDelete = (space: AdminSpace) => {
    setSpaceToDelete(space);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // Séparer les espaces par type puis trier chaque groupe
  const groupSpaces = useMemo(
    () => sortData(data?.data.filter((s) => s.type === 'GROUP') || [], accessors),
    [data, sortData]
  );
  const personalSpaces = useMemo(
    () => sortData(data?.data.filter((s) => s.type === 'PERSONAL') || [], accessors),
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

  const SpaceTable = ({ spaces, showCommunity = false }: { spaces: AdminSpace[]; showCommunity?: boolean }) => (
    <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
      <table className="w-full">
        <thead className="bg-muted sticky top-0 z-10">
          <tr>
            <SortHeader label="Nom" column="name" />
            {showCommunity && (
              <SortHeader label="Communaute" column="community" />
            )}
            <SortHeader label="Proprietaire" column="owner" />
            <SortHeader label="Membres" column="members" />
            <SortHeader label="Elements" column="items" />
            <SortHeader label="Date creation" column="createdAt" />
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {spaces.map((space) => (
            <tr key={space.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedSpaceId(space.id)}>
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
                    onClick={(e) => { e.stopPropagation(); handleDelete(space); }}
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
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Espaces de travail</h1>
        </div>

        {anomaly && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Filtre anomalie : {anomalyLabels[anomaly] || anomaly}
            </span>
            <button
              onClick={clearAnomaly}
              className="ml-auto p-1 rounded hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-500"
              title="Retirer le filtre"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

      {spaceToDelete && (
        <SpaceDeleteConfirmModal
          isOpen={!!spaceToDelete}
          onClose={() => setSpaceToDelete(null)}
          onConfirm={(deleteChildren) => {
            deleteMutation.mutate({ id: spaceToDelete.id, deleteChildren });
          }}
          spaceId={spaceToDelete.id}
          spaceName={spaceToDelete.name}
          isPending={deleteMutation.isPending}
          isAdmin
        />
      )}
    </div>
  );
}

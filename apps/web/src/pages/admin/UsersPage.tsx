import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Shield, User, ArrowUp, ArrowDown } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UserDetailModal } from '../../components/admin/UserDetailModal';
import { useSort } from '../../hooks/useSort';
import type { AdminUser } from '@spok/shared';

const accessors: Record<string, (u: AdminUser) => string | number> = {
  name: (u) => u.name?.toLowerCase() ?? '',
  email: (u) => u.email?.toLowerCase() ?? '',
  spaces: (u) => u._count?.memberships ?? 0,
  createdAt: (u) => u.createdAt,
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalUserId, setModalUserId] = useState<string | null | undefined>(undefined);
  // undefined = modal fermé, null = création, string = édition

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminUser>('name', 'asc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () => adminApi.users.list({ page, pageSize: 100, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const handleDelete = async (user: AdminUser) => {
    if (confirm(`Supprimer l'utilisateur ${user.name} ?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // Séparer les utilisateurs par rôle puis trier chaque groupe
  const adminUsers = useMemo(
    () => sortData(data?.data.filter((u) => u.globalRole === 'ADMIN') || [], accessors),
    [data, sortData]
  );
  const regularUsers = useMemo(
    () => sortData(data?.data.filter((u) => u.globalRole === 'USER') || [], accessors),
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

  const UserTable = ({ users }: { users: AdminUser[] }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <SortHeader label="Nom" column="name" />
            <SortHeader label="Email" column="email" />
            <SortHeader label="Espaces" column="spaces" />
            <SortHeader label="Date creation" column="createdAt" />
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setModalUserId(user.id)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {user.globalRole === 'ADMIN' ? (
                    <Shield className="w-4 h-4 text-primary" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                  {user.name}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {user._count?.memberships ?? 0}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString('fr-FR')}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
                    disabled={deleteMutation.isPending}
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                Aucun utilisateur trouve
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
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button onClick={() => setModalUserId(null)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel utilisateur
        </Button>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email..."
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
          {/* Administrateurs */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Administrateurs
              <span className="text-sm font-normal text-muted-foreground">
                ({adminUsers.length})
              </span>
            </h2>
            <UserTable users={adminUsers} />
          </div>

          {/* Utilisateurs */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" />
              Utilisateurs
              <span className="text-sm font-normal text-muted-foreground">
                ({regularUsers.length})
              </span>
            </h2>
            <UserTable users={regularUsers} />
          </div>

          {data && (
            <p className="text-sm text-muted-foreground text-center">
              {data.pagination.total} utilisateur(s) au total
            </p>
          )}
        </div>
      )}

      {modalUserId !== undefined && (
        <UserDetailModal
          userId={modalUserId}
          onClose={() => setModalUserId(undefined)}
        />
      )}
    </div>
  );
}

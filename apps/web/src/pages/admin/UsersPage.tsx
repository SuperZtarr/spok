import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Shield, User, ArrowUp, ArrowDown, X, AlertTriangle, Mail, MailCheck, ChevronLeft, ChevronRight, Download, Ban, CheckCircle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { UserDetailModal } from '../../components/admin/UserDetailModal';
import { UserProfileModal } from '../../components/UserProfileModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useSort } from '../../hooks/useSort';
import type { AdminUser } from '@spok/shared';

const PAGE_SIZE = 20;

const anomalyLabels: Record<string, string> = {
  'no-personal-space': 'Utilisateurs sans espace personnel',
};

const accessors: Record<string, (u: AdminUser) => string | number> = {
  name: (u) => u.name?.toLowerCase() ?? '',
  email: (u) => u.email?.toLowerCase() ?? '',
  communities: (u) => u._count?.communityMemberships ?? 0,
  spaces: (u) => u._count?.memberships ?? 0,
  items: (u) => u._count?.createdItems ?? 0,
  contributions: (u) => u._count?.contributions ?? 0,
  lastLoginAt: (u) => u.lastLoginAt ?? '',
  status: (u) => (u as any).disabledAt ? 1 : 0,
  createdAt: (u) => u.createdAt,
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return date.toLocaleDateString('fr-FR');
}

function UserAvatar({ user, size = 'sm' }: { user: AdminUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  const initials = (user.name || user.email)
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div
      className={`${sizeClass} rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const anomaly = searchParams.get('anomaly') || undefined;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalUserId, setModalUserId] = useState<string | null | undefined>(undefined);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminUser>('lastLoginAt', 'desc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, search: debouncedSearch, anomaly }],
    queryFn: () => adminApi.users.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, anomaly }),
  });

  const clearAnomaly = () => {
    setSearchParams({});
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.disable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => adminApi.users.enable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const allUsers = useMemo(() => {
    const sorted = sortData(data?.data || [], accessors);
    if (statusFilter === 'active') return sorted.filter((u) => !(u as any).disabledAt);
    if (statusFilter === 'inactive') return sorted.filter((u) => (u as any).disabledAt);
    return sorted;
  }, [data, sortData, statusFilter]);

  const adminUsers = useMemo(() => allUsers.filter((u) => u.globalRole === 'ADMIN'), [allUsers]);
  const regularUsers = useMemo(() => allUsers.filter((u) => u.globalRole === 'USER'), [allUsers]);

  const totalPages = data?.pagination.totalPages ?? 1;

  const handleExportCSV = () => {
    if (!data?.data) return;
    const headers = ['Nom', 'Email', 'Role', 'Email verifie', 'Communautes', 'Espaces', 'Items', 'Contributions', 'Derniere visite', 'Date creation'];
    const rows = data.data.map((u) => [
      u.name,
      u.email,
      u.globalRole,
      u.emailVerified ? 'Oui' : 'Non',
      u._count?.communityMemberships ?? 0,
      u._count?.memberships ?? 0,
      u._count?.createdItems ?? 0,
      u._count?.contributions ?? 0,
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : '',
      new Date(u.createdAt).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, column, className }: { label: string; column: string; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors ${className ?? ''}`}
      onClick={() => toggle(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === column && (
          sortOrder === 'asc'
            ? <ArrowUp className="w-3 h-3" />
            : <ArrowDown className="w-3 h-3" />
        )}
      </span>
    </th>
  );

  const UserRow = ({ user }: { user: AdminUser }) => (
    <tr
      className="hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => setProfileUserId(user.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{user.name}</span>
              {user.globalRole === 'ADMIN' && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  <Shield className="w-3 h-3 mr-0.5" />
                  Admin
                </Badge>
              )}
              {(user as any).disabledAt && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  <Ban className="w-3 h-3 mr-0.5" />
                  Inactif
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {user.emailVerified ? (
                <MailCheck className="w-3 h-3 text-green-500" />
              ) : (
                <Mail className="w-3 h-3 text-orange-400" />
              )}
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground text-center">
        {user._count?.communityMemberships ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground text-center">
        {user._count?.memberships ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground text-center">
        {user._count?.createdItems ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground text-center">
        {user._count?.contributions ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground" title={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}>
        {user.lastLoginAt ? formatRelativeDate(user.lastLoginAt) : <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        {(user as any).disabledAt ? (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactif</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">Actif</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}>
        {formatRelativeDate(user.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {(user as any).disabledAt ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); enableMutation.mutate(user.id); }}
              disabled={enableMutation.isPending}
              title="Réactiver"
              className="h-7 w-7 p-0"
            >
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Désactiver le compte de « ${user.name} » ?`)) {
                  disableMutation.mutate(user.id);
                }
              }}
              disabled={disableMutation.isPending}
              title="Désactiver"
              className="h-7 w-7 p-0"
            >
              <Ban className="w-3.5 h-3.5 text-orange-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setDeletingUser(user); }}
            disabled={deleteMutation.isPending}
            title="Supprimer"
            className="h-7 w-7 p-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );

  const UserTable = ({ users, title, icon: Icon, iconColor }: { users: AdminUser[]; title: string; icon: typeof Shield; iconColor: string }) => (
    <div>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
        <span className="text-xs font-normal text-muted-foreground">({users.length})</span>
      </h2>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <SortHeader label="Utilisateur" column="name" />
              <SortHeader label="Communautes" column="communities" className="text-center" />
              <SortHeader label="Espaces" column="spaces" className="text-center" />
              <SortHeader label="Items" column="items" className="text-center" />
              <SortHeader label="Contrib." column="contributions" className="text-center" />
              <SortHeader label="Derniere visite" column="lastLoginAt" />
              <SortHeader label="Statut" column="status" className="text-center" />
              <SortHeader label="Inscription" column="createdAt" />
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun utilisateur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Utilisateurs</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.pagination.total} utilisateur{data.pagination.total > 1 ? 's' : ''} au total
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="bordered" size="sm" onClick={handleExportCSV} disabled={!data?.data?.length}>
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
            <Button onClick={() => setModalUserId(null)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nouvel utilisateur
            </Button>
          </div>
        </div>

        {anomaly && (
          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {anomalyLabels[anomaly] || anomaly}
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

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email..."
              className="pl-10"
            />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          </div>
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {([['active', 'Actifs'], ['inactive', 'Inactifs'], ['all', 'Tous']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setStatusFilter(value); setPage(1); }}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <div className="space-y-6">
          {adminUsers.length > 0 && (
            <UserTable users={adminUsers} title="Administrateurs" icon={Shield} iconColor="text-primary" />
          )}
          <UserTable users={regularUsers} title="Utilisateurs" icon={User} iconColor="text-muted-foreground" />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-2.5" />
                </Button>
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm px-3">{page} / {totalPages}</span>
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-2.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {profileUserId && (
        <UserProfileModal
          isOpen={true}
          onClose={() => setProfileUserId(null)}
          user={null}
          targetUserId={profileUserId}
        />
      )}

      {modalUserId !== undefined && (
        <UserDetailModal
          userId={modalUserId}
          onClose={() => setModalUserId(undefined)}
        />
      )}
      <ConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => {
          if (deletingUser) deleteMutation.mutate(deletingUser.id);
          setDeletingUser(null);
        }}
        title="Supprimer cet utilisateur ?"
        message={`Supprimer l'utilisateur « ${deletingUser?.name} » ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Search, Trash2, Building2, Users, FolderKanban, ArrowUp, ArrowDown, Eye, EyeOff, Clock, Check, X, ChevronLeft, ChevronRight, Download, GripVertical } from 'lucide-react';
import { adminApi, communitiesApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CommunityDetailModal } from '../../components/admin/CommunityDetailModal';
import { CommunityDeleteConfirmModal } from '../../components/CommunityDeleteConfirmModal';
import { useSort } from '../../hooks/useSort';

const PAGE_SIZE = 20;

interface AdminCommunity {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  pendingPublic?: boolean;
  avatarUrl?: string | null;
  coverUrl?: string | null;
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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return date.toLocaleDateString('fr-FR');
}

function CommunityAvatar({ community }: { community: AdminCommunity }) {
  if (community.avatarUrl) {
    return (
      <img
        src={community.avatarUrl}
        alt={community.name}
        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Building2 className="w-4 h-4 text-primary" />
    </div>
  );
}

function SortableRow({ id, children }: { id: string; children: (props: { dragHandleProps: Record<string, any> }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </tr>
  );
}

export function CommunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalCommunityId, setModalCommunityId] = useState<string | null | undefined>(undefined);
  const [communityToDelete, setCommunityToDelete] = useState<AdminCommunity | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminCommunity>('name', 'asc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'communities', { page, search: debouncedSearch }],
    queryFn: () => adminApi.communities.list({ page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
  });

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

  const reorderMutation = useMutation({
    mutationFn: communitiesApi.reorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sortedCommunities = useMemo(
    () => sortData(data?.data || [], accessors),
    [data, sortData]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedCommunities.map(c => c.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newIds = arrayMove(ids, oldIndex, newIndex);
    reorderMutation.mutate(newIds);
  }, [sortedCommunities, reorderMutation]);

  const pendingCommunities = sortedCommunities.filter(c => c.pendingPublic);
  const totalPages = data?.pagination.totalPages ?? 1;

  const handleExportCSV = () => {
    if (!data?.data) return;
    const headers = ['Nom', 'Description', 'Visibilite', 'Membres', 'Espaces', 'Date creation'];
    const rows = data.data.map((c) => [
      c.name,
      c.description || '',
      c.isPublic ? 'Publique' : 'Privee',
      c.memberCount,
      c.spaceCount,
      new Date(c.createdAt).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communities-${new Date().toISOString().split('T')[0]}.csv`;
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

  return (
    <div className="p-6">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Communautes</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.pagination.total} communaute{data.pagination.total > 1 ? 's' : ''} au total
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.data?.length}>
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
            <Button onClick={() => setModalCommunityId(null)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nouvelle communaute
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou description..."
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
      </div>

      {/* Pending public approval banner */}
      {pendingCommunities.length > 0 && (
        <div className="mb-6 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" />
            En attente d'approbation ({pendingCommunities.length})
          </h2>
          <div className="space-y-2">
            {pendingCommunities.map(community => (
              <div key={community.id} className="flex items-center justify-between bg-background/80 rounded-md px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <CommunityAvatar community={community} />
                  <div>
                    <span className="font-medium text-sm">{community.name}</span>
                    {community.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{community.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {community.memberCount} membre{community.memberCount > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approveMutation.mutate(community.id)}
                    disabled={approveMutation.isPending}
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
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-3 w-8"></th>
                  <SortHeader label="Communaute" column="name" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Visibilite</th>
                  <SortHeader label="Membres" column="members" className="text-center" />
                  <SortHeader label="Espaces" column="spaces" className="text-center" />
                  <SortHeader label="Creation" column="createdAt" />
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Actions</th>
                </tr>
              </thead>
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedCommunities.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y divide-border">
                    {sortedCommunities.map((community) => (
                      <SortableRow key={community.id} id={community.id}>
                        {({ dragHandleProps }) => (
                          <>
                            <td className="px-2 py-3 w-8">
                              <div {...dragHandleProps} className="cursor-grab p-1 text-muted-foreground/40 hover:text-muted-foreground">
                                <GripVertical className="w-4 h-4" />
                              </div>
                            </td>
                            <td className="px-4 py-3 cursor-pointer" onClick={() => setModalCommunityId(community.id)}>
                              <div className="flex items-center gap-3">
                                <CommunityAvatar community={community} />
                                <div className="min-w-0">
                                  <span className="font-medium text-sm truncate block">{community.name}</span>
                                  {community.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[300px]">{community.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          community.isPublic
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {community.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {community.isPublic ? 'Publique' : 'Privee'}
                        </span>
                        {community.pendingPublic && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {community.memberCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <FolderKanban className="w-3.5 h-3.5" />
                        {community.spaceCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(community.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}>
                      {formatRelativeDate(community.createdAt)}
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
                              title="Approuver"
                              className="h-7 w-7 p-0"
                            >
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(community.id); }}
                              disabled={rejectMutation.isPending}
                              title="Rejeter"
                              className="h-7 w-7 p-0"
                            >
                              <X className="w-3.5 h-3.5 text-amber-600" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setCommunityToDelete(community); }}
                          disabled={deleteMutation.isPending}
                          title="Supprimer"
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                            </td>
                          </>
                        )}
                      </SortableRow>
                    ))}
                    {sortedCommunities.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Aucune communaute trouvee
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-2.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm px-3">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
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

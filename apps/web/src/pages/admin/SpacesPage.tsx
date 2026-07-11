/* Admin espaces (/admin/spaces) : liste globale avec compteurs, détail (SpaceDetailModal), suppression. */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Trash2, Users, FolderKanban, User, Building2, ArrowUp, ArrowDown, X, AlertTriangle, ChevronLeft, ChevronRight, Download, GitBranch, FileText, type LucideIcon, List, Columns3, CalendarCheck, GanttChart, Calendar, LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, TrendingDown, Layers, Flame, Table2, Grid3x3, Focus, ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock } from 'lucide-react';
import { VIEW_MODES } from '../../stores/viewMode';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { SpaceDeleteConfirmModal } from '../../components/SpaceDeleteConfirmModal';
import { useSort } from '../../hooks/useSort';

const PAGE_SIZE = 20;

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
  childCount?: number;
  defaultView?: string | null;
  owner: { id: string; name: string; email: string } | null;
  community: { id: string; name: string } | null;
  parent: { id: string; name: string } | null;
}

const SPACE_VIEW_ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock,
};

const accessors: Record<string, (s: AdminSpace) => string | number> = {
  name: (s) => s.name?.toLowerCase() ?? '',
  owner: (s) => s.owner?.name?.toLowerCase() ?? '\uffff',
  community: (s) => s.community?.name?.toLowerCase() ?? '\uffff',
  members: (s) => s.memberCount,
  items: (s) => s.itemCount,
  createdAt: (s) => s.createdAt,
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

export function SpacesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const anomaly = searchParams.get('anomaly') || undefined;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [spaceToDelete, setSpaceToDelete] = useState<AdminSpace | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GROUP' | 'PERSONAL'>('ALL');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { sortKey, sortOrder, toggle, sortData } = useSort<AdminSpace>('name', 'asc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spaces', { page, search: debouncedSearch, anomaly, type: typeFilter === 'ALL' ? undefined : typeFilter }],
    queryFn: () =>
      adminApi.spaces.list({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        anomaly,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
      }),
  });

  const clearAnomaly = () => {
    setSearchParams({});
  };

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      adminApi.spaces.delete(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'spaces'] });
      setSpaceToDelete(null);
    },
  });

  const sortedSpaces = useMemo(
    () => sortData(data?.data || [], accessors),
    [data, sortData]
  );

  const totalPages = data?.pagination.totalPages ?? 1;

  const handleExportCSV = () => {
    if (!data?.data) return;
    const headers = ['Nom', 'Type', 'Communaute', 'Proprietaire', 'Membres', 'Items', 'Date creation'];
    const rows = data.data.map((s) => [
      s.name,
      s.type,
      s.community?.name || '',
      s.owner?.name || '',
      s.memberCount,
      s.itemCount,
      new Date(s.createdAt).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spaces-${new Date().toISOString().split('T')[0]}.csv`;
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
            <h1 className="text-2xl font-bold">Espaces de travail</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.pagination.total} espace{data.pagination.total > 1 ? 's' : ''} au total
              </p>
            )}
          </div>
          <Button variant="bordered" size="sm" onClick={handleExportCSV} disabled={!data?.data?.length}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
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

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom..."
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
          {/* Type filter */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {(['ALL', 'GROUP', 'PERSONAL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {t === 'ALL' ? 'Tous' : t === 'GROUP' ? 'Groupe' : 'Personnel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <SortHeader label="Espace" column="name" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <SortHeader label="Communaute" column="community" />
                  <SortHeader label="Proprietaire" column="owner" />
                  <SortHeader label="Membres" column="members" className="text-center" />
                  <SortHeader label="Items" column="items" className="text-center" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vue défaut</th>
                  <SortHeader label="Creation" column="createdAt" />
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedSpaces.map((space) => (
                  <tr key={space.id} className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/spaces/${space.id}/settings`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className={`w-4 h-4 flex-shrink-0 ${space.type === 'GROUP' ? 'text-green-500' : 'text-blue-500'}`} />
                        <div className="min-w-0">
                          <span className="font-medium text-sm truncate block">{space.name}</span>
                          {space.parent && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <GitBranch className="w-3 h-3" />
                              {space.parent.name}
                            </span>
                          )}
                        </div>
                        {(space.childCount ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                            {space.childCount} sous-esp.
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        space.type === 'GROUP'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {space.type === 'GROUP' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {space.type === 'GROUP' ? 'Groupe' : 'Perso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {space.community ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{space.community.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {space.owner ? (
                        <span title={space.owner.email} className="truncate max-w-[120px] block">{space.owner.name}</span>
                      ) : (
                        <span className="text-orange-400 text-xs">Sans proprio</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        {space.memberCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />
                        {space.itemCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {(() => {
                        if (!space.defaultView) return <span className="text-muted-foreground/40">—</span>;
                        const mode = VIEW_MODES.find(v => v.value === space.defaultView);
                        const Icon = (mode && SPACE_VIEW_ICON_MAP[mode.icon]) || FolderKanban;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{mode?.label ?? space.defaultView}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground" title={new Date(space.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}>
                      {formatRelativeDate(space.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSpaceToDelete(space); }}
                        disabled={deleteMutation.isPending}
                        title="Supprimer"
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {sortedSpaces.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aucun espace trouve
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="bordered" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-2.5" />
                </Button>
                <Button variant="bordered" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm px-3">{page} / {totalPages}</span>
                <Button variant="bordered" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="bordered" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-2.5" />
                </Button>
              </div>
            </div>
          )}
        </>
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

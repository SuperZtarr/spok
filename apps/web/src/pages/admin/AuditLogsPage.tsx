import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, ChevronDown, ChevronRight, Loader2, Database, Filter, Copy, Check } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AuditRestoreDialog } from '../../components/AuditRestoreDialog';

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [id]);
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 group hover:text-foreground text-muted-foreground transition-colors"
      title={id}
    >
      <span className="font-mono text-xs">{id}</span>
      {copied
        ? <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
        : <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  );
}

const ENTITY_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'Item', label: 'Item' },
  { value: 'ItemRelation', label: 'Relation' },
  { value: 'Space', label: 'Espace' },
  { value: 'Community', label: 'Communaute' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'CREATE', label: 'Creation' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'MOVE', label: 'Deplacement' },
  { value: 'BULK_MOVE', label: 'Deplacement groupe' },
  { value: 'ADD_RELATION', label: 'Ajout relation' },
  { value: 'DELETE_RELATION', label: 'Suppression relation' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  MOVE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  BULK_MOVE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ADD_RELATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  DELETE_RELATION: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function AuditLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showPurgeOverflowModal, setShowPurgeOverflowModal] = useState(false);
  const [purgeDays] = useState(90);
  const OVERFLOW_THRESHOLD = 10_000;
  const [restoreUpdateLog, setRestoreUpdateLog] = useState<typeof logs[0] | null>(null);

  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', { page, entity: entityFilter, action: actionFilter, batchId: batchFilter }],
    queryFn: () => adminApi.auditLogs.list({
      page,
      pageSize,
      ...(entityFilter && { entity: entityFilter }),
      ...(actionFilter && { action: actionFilter }),
      ...(batchFilter && { batchId: batchFilter }),
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'audit-logs', 'stats'],
    queryFn: () => adminApi.auditLogs.stats(),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminApi.auditLogs.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
  });

  const restoreUpdateMutation = useMutation({
    mutationFn: ({ id, fieldsToRestore }: { id: string; fieldsToRestore: string[] }) =>
      adminApi.auditLogs.restore(id, fieldsToRestore),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      setRestoreUpdateLog(null);
    },
  });

  const batchRestoreMutation = useMutation({
    mutationFn: (batchId: string) => adminApi.auditLogs.batchRestore(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (days: number) => adminApi.auditLogs.purge(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      setShowPurgeModal(false);
    },
  });

  const purgeOverflowMutation = useMutation({
    mutationFn: () => adminApi.auditLogs.purgeOverflow(OVERFLOW_THRESHOLD),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      setShowPurgeOverflowModal(false);
    },
  });

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  // Group logs by batchId for display
  const logs = data?.data || [];
  const groupedLogs: Array<{ type: 'single'; log: typeof logs[0] } | { type: 'batch'; batchId: string; logs: typeof logs }> = [];
  const batchMap = new Map<string, typeof logs>();
  const processedBatchIds = new Set<string>();

  for (const log of logs) {
    if (log.batchId && !processedBatchIds.has(log.batchId)) {
      const batchLogs = logs.filter(l => l.batchId === log.batchId);
      if (batchLogs.length > 1) {
        batchMap.set(log.batchId, batchLogs);
        processedBatchIds.add(log.batchId);
        groupedLogs.push({ type: 'batch', batchId: log.batchId, logs: batchLogs });
      } else {
        groupedLogs.push({ type: 'single', log });
        processedBatchIds.add(log.batchId);
      }
    } else if (!log.batchId) {
      groupedLogs.push({ type: 'single', log });
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Historique des modifications et restauration</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total logs</p>
            <p className="text-2xl font-bold">{stats.totalCount.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Batches</p>
            <p className="text-2xl font-bold">{stats.batchCount.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Taille estimee</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-muted-foreground" />
              {stats.estimatedSizeMB} Mo
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Maintenance</p>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <Button
                variant="bordered"
                size="sm"
                onClick={() => setShowPurgeModal(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Purger ({purgeDays}j)
              </Button>
              {stats && stats.totalCount > OVERFLOW_THRESHOLD && (
                <Button
                  variant="bordered"
                  size="sm"
                  className="border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  onClick={() => setShowPurgeOverflowModal(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Purger &gt; {OVERFLOW_THRESHOLD.toLocaleString()}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entity/Action breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Par entite</h3>
            <div className="space-y-1">
              {stats.entityBreakdown.map(e => (
                <div key={e.entity} className="flex items-center justify-between text-sm">
                  <span>{e.entity}</span>
                  <span className="text-muted-foreground">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Par action</h3>
            <div className="space-y-1">
              {stats.actionBreakdown.map(a => (
                <div key={a.action} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs ${ACTION_COLORS[a.action] || ''}`}>{a.action}</span>
                  <span className="text-muted-foreground">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="w-40"
          options={ENTITY_OPTIONS}
        />
        <Select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="w-48"
          options={ACTION_OPTIONS}
        />
        <Input
          placeholder="Filtrer par batchId..."
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="w-64"
        />
        {(entityFilter || actionFilter || batchFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setEntityFilter(''); setActionFilter(''); setBatchFilter(''); setPage(1); }}>
            Reinitialiser
          </Button>
        )}
      </div>

      {/* Logs table */}
      <div className="bg-card border border-border rounded-lg overflow-auto max-h-[70vh]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Aucun log trouve</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Utilisateur</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Entite</th>
                <th className="px-4 py-3 text-left font-medium">ID / Titre</th>
                <th className="px-4 py-3 text-left font-medium">Espace</th>
                <th className="px-4 py-3 text-left font-medium">Batch</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedLogs.map((group) => {
                if (group.type === 'single') {
                  const log = group.log;
                  return (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2">{log.user?.name || log.userId}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2">{log.entity}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <CopyId id={log.entityId} />
                          {(() => {
                            const changes = log.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
                            const title = changes?.before?.title || changes?.after?.title;
                            return title ? <span className="text-xs text-muted-foreground truncate" title={String(title)}>{String(title)}</span> : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{log.space?.name || '-'}</td>
                      <td className="px-4 py-2">
                        {log.batchId && (
                          <button
                            className="text-xs text-primary hover:underline font-mono"
                            onClick={() => { setBatchFilter(log.batchId!); setPage(1); }}
                          >
                            {log.batchId.slice(0, 8)}...
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {log.action === 'DELETE' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(log.id)}
                            disabled={restoreMutation.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restaurer
                          </Button>
                        )}
                        {(log.action === 'UPDATE' || log.action === 'MOVE') && (log.changes as any)?.before && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRestoreUpdateLog(log)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restaurer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                } else {
                  const { batchId, logs: batchLogs } = group;
                  const isExpanded = expandedBatches.has(batchId);
                  const mainLog = batchLogs[0];
                  const entityCounts: Record<string, number> = {};
                  batchLogs.forEach(l => { entityCounts[l.entity] = (entityCounts[l.entity] || 0) + 1; });

                  return (
                    <tr key={batchId} className="border-b border-border">
                      <td colSpan={7} className="p-0">
                        {/* Batch header */}
                        <div
                          className="flex items-center gap-3 px-4 py-2 bg-muted/20 cursor-pointer hover:bg-muted/40"
                          onClick={() => toggleBatch(batchId)}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="text-xs font-mono text-muted-foreground">{batchId.slice(0, 8)}...</span>
                          <span className="text-sm">{formatDate(mainLog.createdAt)}</span>
                          <span className="text-sm text-muted-foreground">par {mainLog.user?.name}</span>
                          <div className="flex items-center gap-2">
                            {Object.entries(entityCounts).map(([entity, count]) => (
                              <span key={entity} className="text-xs bg-muted px-2 py-0.5 rounded">
                                {count} {entity}
                              </span>
                            ))}
                          </div>
                          <div className="ml-auto">
                            <Button
                              variant="bordered"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); batchRestoreMutation.mutate(batchId); }}
                              disabled={batchRestoreMutation.isPending}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Restaurer le batch
                            </Button>
                          </div>
                        </div>

                        {/* Batch details */}
                        {isExpanded && (
                          <table className="w-full text-sm">
                            <tbody>
                              {batchLogs.map(log => (
                                <tr key={log.id} className="border-t border-border/50 hover:bg-muted/10">
                                  <td className="px-8 py-1.5 whitespace-nowrap w-40">{formatDate(log.createdAt)}</td>
                                  <td className="px-4 py-1.5 w-32">{log.user?.name}</td>
                                  <td className="px-4 py-1.5 w-32">
                                    <span className={`px-2 py-0.5 rounded text-xs ${ACTION_COLORS[log.action] || ''}`}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="px-4 py-1.5 w-28">{log.entity}</td>
                                  <td className="px-4 py-1.5">
                                    <div className="flex flex-col gap-0.5">
                                      <CopyId id={log.entityId} />
                                      {(() => {
                                        const changes = log.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
                                        const title = changes?.before?.title || changes?.after?.title;
                                        return title ? <span className="text-xs text-muted-foreground truncate" title={String(title)}>{String(title)}</span> : null;
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-4 py-1.5 text-muted-foreground">{log.space?.name || '-'}</td>
                                  <td className="px-4 py-1.5 w-20"></td>
                                  <td className="px-4 py-1.5 text-right w-32">
                                    {log.action === 'DELETE' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => restoreMutation.mutate(log.id)}
                                        disabled={restoreMutation.isPending}
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </Button>
                                    )}
                                    {(log.action === 'UPDATE' || log.action === 'MOVE') && (log.changes as any)?.before && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setRestoreUpdateLog(log)}
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} sur {data.totalPages} ({data.total} logs)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="bordered"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Precedent
            </Button>
            <Button
              variant="bordered"
              size="sm"
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Restore UPDATE dialog */}
      {restoreUpdateLog && (
        <AuditRestoreDialog
          isOpen={!!restoreUpdateLog}
          onClose={() => setRestoreUpdateLog(null)}
          changes={restoreUpdateLog.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null}
          entity={restoreUpdateLog.entity}
          action={restoreUpdateLog.action}
          date={restoreUpdateLog.createdAt}
          userName={restoreUpdateLog.user?.name || restoreUpdateLog.userId}
          onRestore={(fieldsToRestore) => restoreUpdateMutation.mutate({ id: restoreUpdateLog.id, fieldsToRestore })}
          isPending={restoreUpdateMutation.isPending}
        />
      )}

      {/* Purge modal */}
      <ConfirmModal
        isOpen={showPurgeModal}
        onClose={() => setShowPurgeModal(false)}
        onConfirm={() => purgeMutation.mutate(purgeDays)}
        title="Purger les audit logs"
        message={`Supprimer tous les logs de plus de ${purgeDays} jours ?`}
        warning="Cette action est irreversible. Les logs purges ne pourront plus etre utilises pour restaurer des donnees."
        confirmLabel="Purger"
        isPending={purgeMutation.isPending}
      />

      {/* Purge overflow modal */}
      <ConfirmModal
        isOpen={showPurgeOverflowModal}
        onClose={() => setShowPurgeOverflowModal(false)}
        onConfirm={() => purgeOverflowMutation.mutate()}
        title="Purger l'excédent de logs"
        message={`Supprimer les logs les plus anciens au-delà de ${OVERFLOW_THRESHOLD.toLocaleString('fr-FR')} entrées ? Les ${OVERFLOW_THRESHOLD.toLocaleString('fr-FR')} logs les plus récents seront conservés.`}
        warning="Cette action est irréversible. Les logs supprimés ne pourront plus être utilisés pour restaurer des données."
        confirmLabel="Purger l'excédent"
        isPending={purgeOverflowMutation.isPending}
      />
    </div>
  );
}

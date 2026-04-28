import { useState } from 'react';
import type { AuditLog, AuditLogFilters } from '@spok/shared';
import { Button } from '../ui/Button';
import { AuditLogItem } from './AuditLogItem';
import { AuditLogDetail } from './AuditLogDetail';
import { AuditFilters } from './AuditFilters';
import { ConfirmModal } from '../ConfirmModal';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

interface AuditLogListProps {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  onRestore: (log: AuditLog) => void;
  isRestoring?: boolean;
  isLoading?: boolean;
}

export function AuditLogList({
  logs,
  total,
  page,
  totalPages,
  filters,
  onFiltersChange,
  onRestore,
  isRestoring,
  isLoading,
}: AuditLogListProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AuditLog | null>(null);

  const handleRestore = (log: AuditLog) => {
    setRestoreTarget(log);
  };

  return (
    <div className="space-y-4">
      <AuditFilters filters={filters} onFiltersChange={onFiltersChange} />

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <History className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Aucun historique</h3>
          <p className="text-muted-foreground mt-1">
            Les modifications sur cet espace apparaîtront ici.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {logs.map((log) => (
              <AuditLogItem
                key={log.id}
                log={log}
                onViewDetails={setSelectedLog}
                onRestore={handleRestore}
                isRestoring={isRestoring}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {total} entrée{total > 1 ? 's' : ''} au total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="bordered"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                Page {page} sur {totalPages || 1}
              </span>
              <Button
                variant="bordered"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail modal */}
      <AuditLogDetail
        log={selectedLog!}
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        onRestore={handleRestore}
        isRestoring={isRestoring}
      />

      {/* Restore confirmation modal */}
      <ConfirmModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => {
          if (restoreTarget) {
            onRestore(restoreTarget);
            setSelectedLog(null);
            setRestoreTarget(null);
          }
        }}
        title="Restaurer cet état"
        message="Vous êtes sur le point de restaurer un état précédent de cet élément."
        warning="Cette action créera une nouvelle entrée dans l'historique."
        confirmLabel="Restaurer"
        confirmVariant="default"
        isPending={isRestoring}
        icon="warning"
      />
    </div>
  );
}

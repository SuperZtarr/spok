import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AuditLogFilters } from '@spok/shared';
import { ArrowLeft, History } from 'lucide-react';
import { spacesApi } from '../lib/api';
import { useAuditLogs, useRestoreAuditLog } from '../hooks/useAuditLogs';
import { Button } from '../components/ui/Button';
import { AuditLogList } from '../components/audit/AuditLogList';

export function SpaceHistoryPage() {
  const { spaceId } = useParams<{ spaceId: string }>();

  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 20,
  });

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => spacesApi.get(spaceId!),
    enabled: !!spaceId,
  });

  const { data: auditData, isLoading } = useAuditLogs(spaceId!, filters);

  const restoreMutation = useRestoreAuditLog(spaceId!);

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to={`/spaces/${spaceId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'espace
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <History className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Historique</h1>
              <p className="text-muted-foreground">
                {space?.name} - Modifications et restauration
              </p>
            </div>
          </div>
        </div>

        {/* Audit log list */}
        <div className="bg-card border rounded-lg p-4">
          <AuditLogList
            logs={auditData?.data || []}
            total={auditData?.total || 0}
            page={auditData?.page || 1}
            pageSize={auditData?.pageSize || 20}
            totalPages={auditData?.totalPages || 0}
            filters={filters}
            onFiltersChange={setFilters}
            onRestore={(log) => restoreMutation.mutate(log.id)}
            isRestoring={restoreMutation.isPending}
            isLoading={isLoading}
          />
        </div>

        {/* Restore success message */}
        {restoreMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              Restauration effectuée avec succès.
            </p>
          </div>
        )}

        {/* Restore error message */}
        {restoreMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              Erreur lors de la restauration : {(restoreMutation.error as Error)?.message || 'Erreur inconnue'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

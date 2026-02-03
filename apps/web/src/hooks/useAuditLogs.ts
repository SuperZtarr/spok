import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuditLogFilters } from '@spok/shared';
import { auditLogsApi } from '../lib/api';

export function useAuditLogs(spaceId: string, filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ['auditLogs', spaceId, filters],
    queryFn: () => auditLogsApi.list(spaceId, filters),
    enabled: !!spaceId,
  });
}

export function useAuditLog(spaceId: string, logId: string | null) {
  return useQuery({
    queryKey: ['auditLog', spaceId, logId],
    queryFn: () => auditLogsApi.get(spaceId, logId!),
    enabled: !!spaceId && !!logId,
  });
}

export function useRestoreAuditLog(spaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => auditLogsApi.restore(spaceId, logId),
    onSuccess: () => {
      // Invalidate relevant queries after restore
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs', spaceId] });
    },
  });
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';

type TestStatus = 'pass' | 'fail' | 'warning';

const statusConfig: Record<TestStatus, { icon: typeof CheckCircle; color: string; bg: string; badge: string }> = {
  pass: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
  },
  fail: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
  },
};

export function TestsPage() {
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'tests'],
    queryFn: () => adminApi.tests.run(),
    enabled,
    refetchOnWindowFocus: false,
  });

  const handleRun = () => {
    if (enabled) {
      refetch();
    } else {
      setEnabled(true);
    }
  };

  // Group tests by group
  const groups = data
    ? data.tests.reduce<Record<string, typeof data.tests>>((acc, test) => {
        if (!acc[test.group]) acc[test.group] = [];
        acc[test.group].push(test);
        return acc;
      }, {})
    : {};

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tests de non-regression</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-green-600 font-medium">{data.summary.passed} pass</span>
              {data.summary.failed > 0 && (
                <span className="text-red-600 font-medium ml-3">{data.summary.failed} fail</span>
              )}
              {data.summary.warnings > 0 && (
                <span className="text-orange-600 font-medium ml-3">{data.summary.warnings} warning</span>
              )}
              <span className="ml-3">
                — {data.totalDurationMs}ms
                — {new Date(data.executedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={handleRun}
          disabled={isFetching}
        >
          {isFetching ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isFetching ? 'Execution...' : 'Lancer les tests'}
        </Button>
      </div>

      {/* Summary bar */}
      {data && (
        <div className="flex items-center gap-4 mb-6 p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-lg font-semibold text-green-600">{data.summary.passed}</span>
            <span className="text-sm text-muted-foreground">pass</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-lg font-semibold text-red-600">{data.summary.failed}</span>
            <span className="text-sm text-muted-foreground">fail</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-lg font-semibold text-orange-600">{data.summary.warnings}</span>
            <span className="text-sm text-muted-foreground">warning</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{data.totalDurationMs}ms</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && enabled && (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          Execution des tests en cours...
        </div>
      )}

      {/* Initial state */}
      {!enabled && !data && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <Play className="w-8 h-8 mx-auto mb-3" />
          <p>Cliquez sur "Lancer les tests" pour executer les 21 tests de non-regression.</p>
          <p className="text-xs mt-2">Verifie l'integrite BD, la coherence metier, la sante API et les controles d'acces.</p>
        </div>
      )}

      {/* Groups */}
      {Object.entries(groups).map(([groupName, tests]) => {
        const groupPassed = tests.filter(t => t.status === 'pass').length;
        const groupTotal = tests.length;

        return (
          <div key={groupName} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {groupName}
              <span className="ml-2 text-xs font-normal">
                ({groupPassed}/{groupTotal} pass)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {tests.map((test) => {
                const config = statusConfig[test.status];
                const Icon = config.icon;

                return (
                  <div
                    key={test.key}
                    className={`flex items-center justify-between px-4 py-3 ${
                      test.status === 'fail' ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{test.label}</span>
                        <p className="text-xs text-muted-foreground truncate">{test.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {test.count > 0 && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
                          {test.count}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {test.durationMs}ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

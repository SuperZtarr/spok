import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, CheckCircle, AlertTriangle, AlertCircle, Info, Play, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';

// --- Anomalies types & config ---

type Severity = 'error' | 'warning' | 'info';

const severityConfig: Record<Severity, { icon: typeof AlertCircle; color: string; bg: string; badge: string }> = {
  error: {
    icon: AlertCircle,
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
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  },
};

// --- Tests types & config ---

type TestStatus = 'pass' | 'fail' | 'warning';

const testStatusConfig: Record<TestStatus, { icon: typeof CheckCircle; color: string; bg: string; badge: string }> = {
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

const testConsoleLinks: Record<string, { url: string; label: string }> = {
  'biz-users-personal-space': { url: '/admin/users?anomaly=no-personal-space', label: 'Voir les utilisateurs' },
  'biz-spaces-have-owner': { url: '/admin/spaces?anomaly=no-owner', label: 'Voir les espaces' },
  'biz-group-spaces-community': { url: '/admin/spaces?anomaly=no-community', label: 'Voir les espaces' },
  'biz-personal-spaces-single-member': { url: '/admin/spaces?anomaly=multi-member-personal', label: 'Voir les espaces' },
};

// --- Anomalies: Category detail ---

function CategoryDetail({ categoryKey }: { categoryKey: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'anomalies', categoryKey, page],
    queryFn: () => adminApi.anomalies.detail(categoryKey, { page, pageSize: 50 }),
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Aucun élément trouvé.
      </div>
    );
  }

  const isSpaceCategory = categoryKey.startsWith('spaces-');

  return (
    <div className="border-t border-border">
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Titre</th>
              {!isSpaceCategory && (
                <th className="px-4 py-2 text-left font-medium">Espace</th>
              )}
              <th className="px-4 py-2 text-left font-medium">Détail</th>
              <th className="px-4 py-2 text-right font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 max-w-[300px] truncate" title={item.title}>
                  {item.title}
                </td>
                {!isSpaceCategory && (
                  <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                    {item.spaceName || '-'}
                  </td>
                )}
                <td className="px-4 py-2 text-muted-foreground max-w-[300px] truncate" title={item.detail}>
                  {item.detail || '-'}
                </td>
                <td className="px-4 py-2 text-right">
                  {isSpaceCategory && item.id ? (
                    <Link
                      to={`/admin/spaces`}
                      className="text-primary hover:text-primary/80"
                      title="Voir dans l'admin"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </Link>
                  ) : item.spaceId ? (
                    <Link
                      to={`/spaces/${item.spaceId}/content`}
                      className="text-primary hover:text-primary/80"
                      title="Voir l'espace"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.page} / {data.pagination.totalPages} ({data.pagination.total} éléments)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Anomalies Tab ---

function AnomaliesTab() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'anomalies'],
    queryFn: () => adminApi.anomalies.summary(),
  });

  const toggleCategory = (key: string) => {
    setExpandedCategory(prev => prev === key ? null : key);
  };

  const groups = data
    ? data.categories.reduce<Record<string, typeof data.categories>>((acc, cat) => {
        if (!acc[cat.group]) acc[cat.group] = [];
        acc[cat.group].push(cat);
        return acc;
      }, {})
    : {};

  return (
    <>
      {/* Subtitle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.totalAnomalies} anomalies détectées
              {data.checkedAt && ` — ${new Date(data.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Analyse en cours...
        </div>
      )}

      {Object.entries(groups).map(([groupName, categories]) => {
        const groupTotal = categories.reduce((s, c) => s + c.count, 0);
        const typesWithIssues = categories.filter(c => c.count > 0).length;

        return (
          <div key={groupName} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {groupName}
              <span className="ml-2 text-xs font-normal">
                ({typesWithIssues} type{typesWithIssues > 1 ? 's' : ''} — {groupTotal} anomalies)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {categories.map((cat) => {
                const config = severityConfig[cat.severity];
                const Icon = config.icon;
                const isExpanded = expandedCategory === cat.key;
                const hasItems = cat.count > 0;

                return (
                  <div key={cat.key}>
                    <button
                      onClick={() => hasItems && toggleCategory(cat.key)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        hasItems ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-default'
                      } ${isExpanded ? 'bg-muted/30' : ''}`}
                      disabled={!hasItems}
                    >
                      <div className="flex items-center gap-3">
                        {hasItems ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <Icon className={`w-4 h-4 ${hasItems ? config.color : 'text-green-500'}`} />
                        <span className={`text-sm ${hasItems ? '' : 'text-muted-foreground'}`}>
                          {cat.label}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          hasItems ? config.badge : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>

                    {isExpanded && hasItems && (
                      <CategoryDetail categoryKey={cat.key} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// --- Tests Tab ---

function TestsTab() {
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

  const groups = data
    ? data.tests.reduce<Record<string, typeof data.tests>>((acc, test) => {
        if (!acc[test.group]) acc[test.group] = [];
        acc[test.group].push(test);
        return acc;
      }, {})
    : {};

  return (
    <>
      {/* Subtitle + run button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {data && (
            <p className="text-sm text-muted-foreground">
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
          size="sm"
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
          <p>Cliquez sur "Lancer les tests" pour executer les tests de non-regression.</p>
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
                const config = testStatusConfig[test.status];
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
                      {test.count > 0 && testConsoleLinks[test.key] && (
                        <Link
                          to={testConsoleLinks[test.key].url}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                          title={testConsoleLinks[test.key].label}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {testConsoleLinks[test.key].label}
                        </Link>
                      )}
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
    </>
  );
}

// --- Main Page ---

type Tab = 'anomalies' | 'tests';

export function AnomaliesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('anomalies');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <h1 className="text-2xl font-bold mb-3">Diagnostics</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'anomalies'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Anomalies
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tests'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Play className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Tests
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'anomalies' ? <AnomaliesTab /> : <TestsTab />}
      </div>
    </div>
  );
}

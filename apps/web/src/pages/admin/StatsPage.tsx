import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, FileText, MessageSquare, Users, FolderKanban } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { adminApi } from '../../lib/api';

const PERIODS = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: '365d', label: '1a' },
  { value: 'all', label: 'Tout' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  NOTE: '#3b82f6',
  PROJECT: '#8b5cf6',
  TASK: '#f59e0b',
  MEETING: '#10b981',
  PERIOD: '#6366f1',
  LINK: '#ec4899',
  CONFIG: '#64748b',
  DOCUMENT: '#0ea5e9',
  IMAGE: '#14b8a6',
};

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof FileText }) {
  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card">
      <div className="p-2 rounded-md bg-accent/50">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString('fr-FR')}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function StatsPage() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', period],
    queryFn: () => adminApi.stats.get(period),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          Chargement des statistiques...
        </div>
      )}

      {data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Items" value={data.totals.items} icon={FileText} />
            <StatCard label="Contributions" value={data.totals.contributions} icon={MessageSquare} />
            <StatCard label="Utilisateurs" value={data.totals.users} icon={Users} />
            <StatCard label="Espaces" value={data.totals.spaces} icon={FolderKanban} />
          </div>

          {/* Activity chart */}
          <div className="border border-border rounded-lg bg-card p-4 mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Activite
            </h2>
            {data.timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => {
                      const [, m, day] = d.split('-');
                      return `${day}/${m}`;
                    }}
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(d: string) => {
                      const date = new Date(d);
                      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="itemsCreated"
                    name="Creations"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="itemsModified"
                    name="Modifications"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="contributions"
                    name="Contributions"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucune donnee pour cette periode</p>
            )}
          </div>

          {/* Bottom row: by type + top spaces */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By type */}
            <div className="border border-border rounded-lg bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Repartition par type
              </h2>
              {data.byType.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="type"
                      width={80}
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Items"
                      radius={[0, 4, 4, 0]}
                      fill="#3b82f6"
                      // Custom color per bar
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const color = TYPE_COLORS[payload.type] || '#64748b';
                        return <rect x={x} y={y} width={width} height={height} rx={4} fill={color} />;
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-8 text-muted-foreground">Aucun item</p>
              )}
            </div>

            {/* Top spaces */}
            <div className="border border-border rounded-lg bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Top 10 espaces
              </h2>
              {data.topSpaces.length > 0 ? (
                <div className="space-y-2">
                  {data.topSpaces.map((space, i) => {
                    const total = space.itemCount + space.contributionCount;
                    const maxTotal = data.topSpaces[0].itemCount + data.topSpaces[0].contributionCount;
                    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

                    return (
                      <div key={space.spaceId} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{space.spaceName}</span>
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {space.itemCount} items, {space.contributionCount} contribs
                            </span>
                          </div>
                          <div className="w-full bg-accent/50 rounded-full h-1.5">
                            <div
                              className="bg-primary rounded-full h-1.5 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">Aucun espace</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

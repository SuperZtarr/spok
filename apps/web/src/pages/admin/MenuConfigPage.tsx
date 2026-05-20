import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff } from 'lucide-react';
import { adminMenuApi } from '../../lib/api';
import { useCtrlS } from '../../hooks/useCtrlS';
import type { MenuItemConfig, MenuAccess, MenuOverride } from '@spok/shared';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

const ACCESS_OPTIONS = [
  { value: 'public', label: 'Public (tous)' },
  { value: 'user', label: 'Utilisateurs connectés' },
  { value: 'admin', label: 'Administrateurs' },
];

const ACCESS_COLORS: Record<MenuAccess, string> = {
  public: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const SECTION_COLORS: Record<string, string> = {
  global:      '',
  personal:    '',
  basic:       'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40',
  itemTypes:   'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40',
  planning:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40',
  exploration: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40',
  admin:       'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40',
  misc:        'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800',
};

const LOCKED_KEYS = new Set(['profile', 'logout']);

export function MenuConfigPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'menu-items'],
    queryFn: adminMenuApi.getAll,
  });

  const [items, setItems] = useState<MenuItemConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) setItems([...data].sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order));
  }, [data]);

  const toOverrides = (list: MenuItemConfig[]): MenuOverride[] =>
    list
      .filter(item => !LOCKED_KEYS.has(item.key))
      .map(({ key, visible, access }) => ({ key, visible, access }));

  const saveMutation = useMutation({
    mutationFn: () => adminMenuApi.update(toOverrides(items)),
    onSuccess: (result) => {
      setItems([...result].sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order));
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setHasChanges(false);
    },
  });

  useCtrlS(hasChanges && !saveMutation.isPending, () => saveMutation.mutate());

  const resetMutation = useMutation({
    mutationFn: () => adminMenuApi.reset(),
    onSuccess: (result) => {
      setItems([...result].sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order));
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setHasChanges(false);
    },
  });

  const updateItem = useCallback((key: string, updates: Partial<Pick<MenuItemConfig, 'visible' | 'access'>>) => {
    setItems(prev => prev.map(item => item.key === key ? { ...item, ...updates } : item));
    setHasChanges(true);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sections = new Map<string, { label: string; order: number; items: MenuItemConfig[] }>();
  for (const item of items) {
    if (!sections.has(item.section)) {
      sections.set(item.section, { label: item.sectionLabel, order: item.sectionOrder, items: [] });
    }
    sections.get(item.section)!.items.push(item);
  }
  const sortedSections = Array.from(sections.entries()).sort((a, b) => a[1].order - b[1].order);

  const renderRow = (item: MenuItemConfig) => {
    const locked = LOCKED_KEYS.has(item.key);
    return (
      <div key={item.key} className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-xs font-mono text-muted-foreground w-36 flex-shrink-0 truncate" title={item.key}>{item.key}</span>
        <span className="text-sm flex-1 truncate">{item.label}</span>
        <Select
          value={item.access}
          onChange={(e) => updateItem(item.key, { access: e.target.value as MenuAccess })}
          options={locked ? [{ value: item.access, label: ACCESS_OPTIONS.find(o => o.value === item.access)?.label || item.access }] : ACCESS_OPTIONS}
          className="text-sm w-48"
          disabled={locked}
        />
        <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[item.access]}`}>{item.access}</span>
        <button
          onClick={() => !locked && updateItem(item.key, { visible: !item.visible })}
          disabled={locked}
          className={`p-1.5 rounded transition-colors ${locked ? 'text-muted-foreground/20 cursor-not-allowed' : item.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}
          title={locked ? 'Verrouillé' : item.visible ? 'Visible' : 'Masqué'}
        >
          {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Configuration des menus</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visibilité et droits d'accès par fonctionnalité</p>
          </div>
          <div className="flex gap-2">
            <Button variant="bordered" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Réinitialiser
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {sortedSections.map(([sectionId, section]) => (
          <div key={sectionId}>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
              {section.label}
              <span className="ml-2 text-muted-foreground/60">({section.items.length})</span>
            </h2>
            <div className={`border rounded-lg divide-y divide-border ${SECTION_COLORS[sectionId] || 'bg-card'}`}>
              {section.items.sort((a, b) => a.order - b.order).map(item => renderRow(item))}
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end mt-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="shadow-lg">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

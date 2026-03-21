import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { adminMenuApi } from '../../lib/api';
import type { MenuItemConfig, MenuAccess } from '@spok/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const ACCESS_OPTIONS = [
  { value: 'public', label: 'Public (tous)' },
  { value: 'user', label: 'Utilisateurs connectes' },
  { value: 'admin', label: 'Administrateurs' },
];

const ACCESS_COLORS: Record<MenuAccess, string> = {
  public: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const SECTION_CONFIG: { value: string; label: string; order: number; color: string }[] = [
  { value: 'global', label: 'Vues globales', order: 0, color: '' },
  { value: 'basic', label: 'Basique', order: 1, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' },
  { value: 'itemTypes', label: 'Types', order: 2, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' },
  { value: 'planning', label: 'Planification', order: 3, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' },
  { value: 'exploration', label: 'Exploration', order: 4, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' },
  { value: 'admin', label: 'Administration', order: 5, color: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' },
  { value: 'misc', label: 'Divers', order: 6, color: 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800' },
];
const SECTION_OPTIONS = SECTION_CONFIG.map(s => ({ value: s.value, label: s.label }));

export function MenuConfigPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'menu-items'],
    queryFn: adminMenuApi.getAll,
  });

  const [items, setItems] = useState<MenuItemConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setItems([...data].sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => adminMenuApi.update(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setHasChanges(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => adminMenuApi.reset(),
    onSuccess: (result) => {
      setItems([...result].sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order));
      queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setHasChanges(false);
    },
  });

  const updateItem = useCallback((key: string, updates: Partial<MenuItemConfig>) => {
    setItems(prev => prev.map(item => item.key === key ? { ...item, ...updates } : item));
    setHasChanges(true);
  }, []);

  const moveItem = useCallback((key: string, direction: 'up' | 'down') => {
    setItems(prev => {
      const item = prev.find(i => i.key === key);
      if (!item) return prev;
      // Move within same section
      const sectionItems = prev.filter(i => i.section === item.section).sort((a, b) => a.order - b.order);
      const idx = sectionItems.findIndex(i => i.key === key);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sectionItems.length) return prev;
      const tmpOrder = sectionItems[idx].order;
      const result = prev.map(i => {
        if (i.key === sectionItems[idx].key) return { ...i, order: sectionItems[swapIdx].order };
        if (i.key === sectionItems[swapIdx].key) return { ...i, order: tmpOrder };
        return i;
      });
      return result.sort((a, b) => a.sectionOrder - b.sectionOrder || a.order - b.order);
    });
    setHasChanges(true);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group items by section
  const sections = new Map<string, { label: string; order: number; items: MenuItemConfig[] }>();
  for (const item of items) {
    if (!sections.has(item.section)) {
      sections.set(item.section, { label: item.sectionLabel, order: item.sectionOrder, items: [] });
    }
    sections.get(item.section)!.items.push(item);
  }
  const sortedSections = Array.from(sections.entries()).sort((a, b) => a[1].order - b[1].order);

  const renderRow = (item: MenuItemConfig) => {
    const locked = item.key === 'profile' || item.key === 'logout';
    return (
      <div key={item.key} className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex flex-col gap-0.5">
          <button onClick={() => moveItem(item.key, 'up')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => moveItem(item.key, 'down')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
        </div>
        <span className="text-xs font-mono text-muted-foreground w-32 flex-shrink-0 truncate" title={item.key}>{item.key}</span>
        <Input value={item.label} onChange={(e) => updateItem(item.key, { label: e.target.value })} className="text-sm w-40" />
        <Select value={item.section} onChange={(e) => {
          const sec = SECTION_CONFIG.find(s => s.value === e.target.value);
          if (sec) updateItem(item.key, { section: sec.value, sectionLabel: sec.label, sectionOrder: sec.order });
        }} options={SECTION_OPTIONS} className="text-sm w-40" />
        <Select
          value={item.access}
          onChange={(e) => updateItem(item.key, { access: e.target.value as MenuAccess })}
          options={locked ? [{ value: item.access, label: ACCESS_OPTIONS.find(o => o.value === item.access)?.label || item.access }] : ACCESS_OPTIONS}
          className="text-sm w-44"
          disabled={locked}
        />
        <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[item.access]}`}>{item.access}</span>
        <button
          onClick={() => !locked && updateItem(item.key, { visible: !item.visible })}
          disabled={locked}
          className={`p-1.5 rounded transition-colors ${locked ? 'text-muted-foreground/20 cursor-not-allowed' : item.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}
          title={locked ? 'Verrouille' : item.visible ? 'Visible' : 'Masque'}
        >
          {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Configuration des menus</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Libelles, ordre, sections et droits d'acces</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reinitialiser
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
            <div className={`border rounded-lg divide-y divide-border ${SECTION_CONFIG.find(s => s.value === sectionId)?.color || 'bg-card'}`}>
              {section.items.sort((a, b) => a.order - b.order).map(item => renderRow(item))}
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end mt-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="shadow-lg">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}

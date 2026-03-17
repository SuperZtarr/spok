import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { adminConfigApi } from '../../lib/api';
import type { ViewConfigItem, ViewCategoryConfig, ViewAccess, ViewCategory } from '@spok/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const ACCESS_OPTIONS = [
  { value: 'public', label: 'Public (tous)' },
  { value: 'user', label: 'Utilisateurs connectés' },
  { value: 'admin', label: 'Administrateurs' },
];

const ACCESS_COLORS: Record<ViewAccess, string> = {
  public: 'bg-green-100 text-green-800',
  user: 'bg-blue-100 text-blue-800',
  admin: 'bg-red-100 text-red-800',
};

export function ViewsConfigPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'view-config'],
    queryFn: adminConfigApi.getViews,
  });

  const [views, setViews] = useState<ViewConfigItem[]>([]);
  const [categories, setCategories] = useState<ViewCategoryConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setViews([...data.views].sort((a, b) => a.order - b.order));
      setCategories([...data.categories].sort((a, b) => a.order - b.order));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => adminConfigApi.updateViews({ views, categories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'view-config'] });
      queryClient.invalidateQueries({ queryKey: ['view-config'] });
      setHasChanges(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: adminConfigApi.resetViews,
    onSuccess: (result) => {
      setViews([...result.views].sort((a, b) => a.order - b.order));
      setCategories([...result.categories].sort((a, b) => a.order - b.order));
      queryClient.invalidateQueries({ queryKey: ['admin', 'view-config'] });
      queryClient.invalidateQueries({ queryKey: ['view-config'] });
      setHasChanges(false);
    },
  });

  const updateView = useCallback((id: string, updates: Partial<ViewConfigItem>) => {
    setViews(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    setHasChanges(true);
  }, []);

  const moveView = useCallback((id: string, direction: 'up' | 'down') => {
    setViews(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(v => v.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      // Swap orders
      const tmpOrder = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: tmpOrder };
      return sorted.sort((a, b) => a.order - b.order);
    });
    setHasChanges(true);
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<ViewCategoryConfig>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } as ViewCategoryConfig : c));
    setHasChanges(true);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.label }));

  // Group views by category
  const viewsByCategory = categories.map(cat => ({
    category: cat,
    views: views.filter(v => v.category === cat.id).sort((a, b) => a.order - b.order),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configuration des vues</h1>
          <p className="text-muted-foreground text-sm">Gérez les libellés, l'ordre, les catégories et les droits d'accès des vues</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Réinitialiser
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Categories config */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Catégories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <Input
                value={cat.label}
                onChange={(e) => updateCategory(cat.id, { label: e.target.value })}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Views by category */}
      {viewsByCategory.map(({ category, views: catViews }) => (
        <div key={category.id} className="mb-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{category.label}</h2>
          <div className="bg-card border rounded-lg divide-y">
            {catViews.map((view) => (
              <div key={view.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* Drag handle / reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveView(view.id, 'up')}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                    title="Monter"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveView(view.id, 'down')}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                    title="Descendre"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ID (readonly) */}
                <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{view.id}</span>

                {/* Label (editable) */}
                <Input
                  value={view.label}
                  onChange={(e) => updateView(view.id, { label: e.target.value })}
                  className="text-sm w-40"
                />

                {/* Category */}
                <Select
                  value={view.category}
                  onChange={(e) => updateView(view.id, { category: e.target.value as ViewCategory })}
                  options={categoryOptions}
                  className="text-sm w-40"
                />

                {/* Access */}
                <Select
                  value={view.access}
                  onChange={(e) => updateView(view.id, { access: e.target.value as ViewAccess })}
                  options={ACCESS_OPTIONS}
                  className="text-sm w-44"
                />

                {/* Access badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[view.access]}`}>
                  {view.access}
                </span>

                {/* Visibility toggle */}
                <button
                  onClick={() => updateView(view.id, { visible: !view.visible })}
                  className={`p-1.5 rounded transition-colors ${view.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}
                  title={view.visible ? 'Visible — cliquer pour masquer' : 'Masquée — cliquer pour afficher'}
                >
                  {view.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}

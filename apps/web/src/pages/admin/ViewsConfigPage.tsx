import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { adminConfigApi } from '../../lib/api';
import type { ViewConfigItem, ViewCategoryConfig, ViewAccess, ViewCategory, GlobalPageConfig, GlobalPageGroupConfig, GlobalPageGroup } from '@spok/shared';
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

  const { data: gpData, isLoading: gpLoading } = useQuery({
    queryKey: ['admin', 'global-pages-config'],
    queryFn: adminConfigApi.getGlobalPages,
  });

  const [views, setViews] = useState<ViewConfigItem[]>([]);
  const [categories, setCategories] = useState<ViewCategoryConfig[]>([]);
  const [globalPages, setGlobalPages] = useState<GlobalPageConfig[]>([]);
  const [pageGroups, setPageGroups] = useState<GlobalPageGroupConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setViews([...data.views].sort((a, b) => a.order - b.order));
      setCategories([...data.categories].sort((a, b) => a.order - b.order));
    }
  }, [data]);

  useEffect(() => {
    if (gpData) {
      setGlobalPages([...gpData.pages].sort((a, b) => a.order - b.order));
      setPageGroups([...gpData.groups].sort((a, b) => a.order - b.order));
    }
  }, [gpData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await adminConfigApi.updateViews({ views, categories });
      await adminConfigApi.updateGlobalPages({ pages: globalPages, groups: pageGroups });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'view-config'] });
      queryClient.invalidateQueries({ queryKey: ['view-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'global-pages-config'] });
      queryClient.invalidateQueries({ queryKey: ['global-pages-config'] });
      setHasChanges(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const viewResult = await adminConfigApi.resetViews();
      const gpResult = await adminConfigApi.resetGlobalPages();
      return { viewResult, gpResult };
    },
    onSuccess: ({ viewResult, gpResult }) => {
      setViews([...viewResult.views].sort((a, b) => a.order - b.order));
      setCategories([...viewResult.categories].sort((a, b) => a.order - b.order));
      setGlobalPages([...gpResult.pages].sort((a, b) => a.order - b.order));
      setPageGroups([...gpResult.groups].sort((a, b) => a.order - b.order));
      queryClient.invalidateQueries({ queryKey: ['admin', 'view-config'] });
      queryClient.invalidateQueries({ queryKey: ['view-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'global-pages-config'] });
      queryClient.invalidateQueries({ queryKey: ['global-pages-config'] });
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

  const updateGlobalPage = useCallback((id: string, updates: Partial<GlobalPageConfig>) => {
    setGlobalPages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setHasChanges(true);
  }, []);

  const moveGlobalPage = useCallback((id: string, direction: 'up' | 'down') => {
    setGlobalPages(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const tmpOrder = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: tmpOrder };
      return sorted.sort((a, b) => a.order - b.order);
    });
    setHasChanges(true);
  }, []);

  const updatePageGroup = useCallback((id: string, updates: Partial<GlobalPageGroupConfig>) => {
    setPageGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } as GlobalPageGroupConfig : g));
    setHasChanges(true);
  }, []);

  const groupOptions = pageGroups.map(g => ({ value: g.id, label: g.label }));

  // Group global pages by group
  const pagesByGroup = pageGroups.map(grp => ({
    group: grp,
    pages: globalPages.filter(p => p.group === grp.id).sort((a, b) => a.order - b.order),
  }));

  if (isLoading || gpLoading) {
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
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration des vues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Libelles, ordre, categories et droits d'acces</p>
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

      {/* ── Pages globales ── */}
      <div className="mt-12 mb-6 border-t pt-8">
        <h1 className="text-2xl font-bold mb-0.5">Pages globales</h1>
        <p className="text-sm text-muted-foreground mb-6">Onglets du menu principal (accueil, communautes, dashboard...)</p>
      </div>

      {/* Page groups config */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Groupes</h2>
        <div className="grid grid-cols-2 gap-3">
          {pageGroups.map(grp => (
            <div key={grp.id} className="flex items-center gap-2">
              <Input
                value={grp.label}
                onChange={(e) => updatePageGroup(grp.id, { label: e.target.value })}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Global pages by group */}
      {pagesByGroup.map(({ group, pages: grpPages }) => (
        <div key={group.id} className="mb-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">{group.label}</h2>
          <div className="bg-card border rounded-lg divide-y">
            {grpPages.map((page) => (
              <div key={page.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveGlobalPage(page.id, 'up')}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                    title="Monter"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveGlobalPage(page.id, 'down')}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                    title="Descendre"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{page.id}</span>

                <Input
                  value={page.label}
                  onChange={(e) => updateGlobalPage(page.id, { label: e.target.value })}
                  className="text-sm w-40"
                />

                <Select
                  value={page.group}
                  onChange={(e) => updateGlobalPage(page.id, { group: e.target.value as GlobalPageGroup })}
                  options={groupOptions}
                  className="text-sm w-40"
                />

                <Select
                  value={page.access}
                  onChange={(e) => updateGlobalPage(page.id, { access: e.target.value as ViewAccess })}
                  options={ACCESS_OPTIONS}
                  className="text-sm w-44"
                />

                <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[page.access]}`}>
                  {page.access}
                </span>

                <button
                  onClick={() => updateGlobalPage(page.id, { visible: !page.visible })}
                  className={`p-1.5 rounded transition-colors ${page.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}
                  title={page.visible ? 'Visible — cliquer pour masquer' : 'Masquée — cliquer pour afficher'}
                >
                  {page.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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

/* Admin config des vues (/admin/views) : AppConfig du système useViewConfig — cf. skill spok-menu. */
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { adminConfigApi } from '../../lib/api';
import { useCtrlS } from '../../hooks/useCtrlS';
import type { ViewConfigItem, ViewCategoryConfig, ViewAccess, ViewCategory, GlobalPageConfig, GlobalPageGroupConfig, GlobalPageGroup } from '@spok/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const ACCESS_OPTIONS = [
  { value: 'public', label: 'Public (tous)' },
  { value: 'user', label: 'Utilisateurs connectes' },
  { value: 'admin', label: 'Administrateurs' },
];

const ACCESS_COLORS: Record<ViewAccess, string> = {
  public: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

type Tab = 'global-pages' | 'space-views' | 'misc' | 'categories';

export function ViewsConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('global-pages');

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

  useCtrlS(hasChanges && !saveMutation.isPending, () => saveMutation.mutate());

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

  if (isLoading || gpLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryOptions = categories.filter(c => c.id !== 'dashboard').map(c => ({ value: c.id, label: c.label }));
  const groupOptions = pageGroups.map(g => ({ value: g.id, label: g.label }));

  const viewsByCategory = categories
    .filter(c => c.id !== 'dashboard')
    .map(cat => ({
      category: cat,
      views: views.filter(v => v.category === cat.id).sort((a, b) => a.order - b.order),
    }));

  const pagesByGroup = pageGroups
    .filter(grp => grp.id !== 'misc')
    .map(grp => ({
      group: grp,
      pages: globalPages.filter(p => p.group === grp.id).sort((a, b) => a.order - b.order),
    }));

  // Render a config row for a view or page
  const renderViewRow = (item: ViewConfigItem) => (
    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex flex-col gap-0.5">
        <button onClick={() => moveView(item.id, 'up')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => moveView(item.id, 'down')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>
      <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{item.id}</span>
      <Input value={item.label} onChange={(e) => updateView(item.id, { label: e.target.value })} className="text-sm w-40" />
      <Select value={item.category} onChange={(e) => updateView(item.id, { category: e.target.value as ViewCategory })} options={categoryOptions} className="text-sm w-40" />
      <Select value={item.access} onChange={(e) => updateView(item.id, { access: e.target.value as ViewAccess })} options={ACCESS_OPTIONS} className="text-sm w-44" />
      <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[item.access]}`}>{item.access}</span>
      <button onClick={() => updateView(item.id, { visible: !item.visible })} className={`p-1.5 rounded transition-colors ${item.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}>
        {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );

  const renderPageRow = (page: GlobalPageConfig) => (
    <div key={page.id} className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex flex-col gap-0.5">
        <button onClick={() => moveGlobalPage(page.id, 'up')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => moveGlobalPage(page.id, 'down')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>
      <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{page.id}</span>
      <Input value={page.label} onChange={(e) => updateGlobalPage(page.id, { label: e.target.value })} className="text-sm w-40" />
      <Select value={page.group} onChange={(e) => updateGlobalPage(page.id, { group: e.target.value as GlobalPageGroup })} options={groupOptions} className="text-sm w-40" />
      <Select value={page.access} onChange={(e) => updateGlobalPage(page.id, { access: e.target.value as ViewAccess })} options={ACCESS_OPTIONS} className="text-sm w-44" />
      <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[page.access]}`}>{page.access}</span>
      <button onClick={() => updateGlobalPage(page.id, { visible: !page.visible })} className={`p-1.5 rounded transition-colors ${page.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}>
        {page.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'global-pages', label: 'Pages globales' },
    { id: 'space-views', label: 'Vues d\'espace' },
    { id: 'misc', label: 'Divers' },
    { id: 'categories', label: 'Categories & Groupes' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Configuration des vues</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Libelles, ordre, categories et droits d'acces</p>
          </div>
          <div className="flex gap-2">
            <Button variant="bordered" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reinitialiser
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {/* Tab 1: Pages globales */}
        {activeTab === 'global-pages' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Pages du menu principal : accueil, communautes, espaces, graphe, tableau de bord...</p>
            {pagesByGroup.map(({ group, pages: grpPages }) => (
              <div key={group.id}>
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">{group.label}</h2>
                <div className="bg-card border rounded-lg divide-y divide-border">
                  {grpPages.map(page => renderPageRow(page))}
                  {grpPages.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">Aucune page dans ce groupe</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Vues d'espace */}
        {activeTab === 'space-views' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Vues disponibles dans les espaces : liste, kanban, gantt, graphe, carte mentale...</p>
            {viewsByCategory.map(({ category, views: catViews }) => (
              <div key={category.id}>
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">{category.label}</h2>
                <div className="bg-card border rounded-lg divide-y divide-border">
                  {catViews.map(view => renderViewRow(view))}
                  {catViews.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">Aucune vue dans cette categorie</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Divers */}
        {activeTab === 'misc' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Elements du menu "Divers" : recherche, profil, plan du site, deconnexion. Ordre et acces configurables. Profil et Deconnexion ne peuvent pas etre masques.</p>
            <div className="bg-card border rounded-lg divide-y divide-border">
              {globalPages.filter(p => p.group === 'misc').sort((a, b) => a.order - b.order).map(page => {
                const locked = page.id === 'profile' || page.id === 'logout';
                return (
                  <div key={page.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveGlobalPage(page.id, 'up')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveGlobalPage(page.id, 'down')} className="p-0.5 rounded hover:bg-accent text-muted-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">{page.id}</span>
                    <Input value={page.label} onChange={(e) => updateGlobalPage(page.id, { label: e.target.value })} className="text-sm w-40" />
                    <Select
                      value={page.access}
                      onChange={(e) => updateGlobalPage(page.id, { access: e.target.value as ViewAccess })}
                      options={locked ? [{ value: page.access, label: ACCESS_OPTIONS.find(o => o.value === page.access)?.label || page.access }] : ACCESS_OPTIONS}
                      className="text-sm w-44"
                      disabled={locked}
                    />
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ACCESS_COLORS[page.access]}`}>{page.access}</span>
                    <button
                      onClick={() => !locked && updateGlobalPage(page.id, { visible: !page.visible })}
                      disabled={locked}
                      className={`p-1.5 rounded transition-colors ${locked ? 'text-muted-foreground/20 cursor-not-allowed' : page.visible ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 hover:bg-accent'}`}
                      title={locked ? 'Verrouille' : page.visible ? 'Visible' : 'Masque'}
                    >
                      {page.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Categories & Groupes */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Categories de vues d'espace</h2>
              <p className="text-sm text-muted-foreground mb-3">Noms des sections dans le menu pour les vues d'espace</p>
              <div className="bg-card border rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {categories.filter(c => c.id !== 'dashboard').map(cat => (
                    <div key={cat.id} className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{cat.id}</label>
                      <Input value={cat.label} onChange={(e) => updateCategory(cat.id, { label: e.target.value })} className="text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Groupes de pages globales</h2>
              <p className="text-sm text-muted-foreground mb-3">Noms des sections dans le menu pour les pages globales</p>
              <div className="bg-card border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  {pageGroups.filter(g => g.id !== 'misc').map(grp => (
                    <div key={grp.id} className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{grp.id}</label>
                      <Input value={grp.label} onChange={(e) => updatePageGroup(grp.id, { label: e.target.value })} className="text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating save button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="shadow-lg">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

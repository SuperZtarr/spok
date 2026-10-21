/* Admin « Configuration des vues » (/admin/views) : visibilité et niveau d'accès de chaque page globale et de chaque
   vue d'espace, pour tout SPOK — surcharges AppConfig 'menu_overrides' du registre MENU_REGISTRY (GET /admin/menu,
   PUT /admin/menu/overrides), lues par useMenuItems (navigation globale, sélecteur de vues). Rebranchée le
   2026-10-21 : l'ancienne page éditait un système parallèle (useViewConfig) qu'aucun écran ne lisait.
   La section admin n'est pas modifiable (refus API). Les familles et modes d'interface restent dans le code
   (SpaceToolbar) : ici on ne décide que « visible » et « qui y a accès ».
   Aide utilisateur : fiche pages/help/admin-views.help.ts — « ? » (PageHelpButton), rappels fonctionnels (pageHint). */
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, Eye, EyeOff, Undo2 } from 'lucide-react';
import type { MenuAccess, MenuOverride } from '@spok/shared';
import { adminMenuApi, type AdminMenuEntry } from '../../lib/api';
import { useCtrlS } from '../../hooks/useCtrlS';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { PageHelpButton } from '../../help/PageHelpButton';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

const ACCESS_LABELS: Record<MenuAccess, string> = { public: 'Tous', user: 'Connectés', admin: 'Admins' };
const ACCESS_OPTIONS = (Object.keys(ACCESS_LABELS) as MenuAccess[]).map((value) => ({ value, label: ACCESS_LABELS[value] }));

/** Onglets : sections du registre (les vues d'espace d'un côté, la navigation globale de l'autre). */
const TABS = [
  { id: 'pages', label: 'Pages globales', sections: ['global', 'personal', 'misc'] },
  { id: 'views', label: 'Vues d\'espace', sections: ['basic', 'itemTypes', 'planning', 'exploration'] },
] as const;
type TabId = (typeof TABS)[number]['id'];

type Draft = Record<string, { visible: boolean; access: MenuAccess }>;

export function ViewsConfigPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('views');
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'menu'], queryFn: adminMenuApi.getAll });
  const [draft, setDraft] = useState<Draft>({});

  // Brouillon local initialisé sur la valeur effective ; rien n'est envoyé avant « Enregistrer »
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((e) => [e.key, { visible: e.visible, access: e.access }])));
  }, [data]);

  const byKey = useMemo(() => new Map((data ?? []).map((e) => [e.key, e])), [data]);
  const hasChanges = !!data && data.some((e) => draft[e.key] && (draft[e.key].visible !== e.visible || draft[e.key].access !== e.access));

  const saveMutation = useMutation({
    mutationFn: () => {
      // Seules les différences avec le code deviennent des surcharges (l'API refiltre aussi)
      const overrides: MenuOverride[] = (data ?? [])
        .filter((e) => draft[e.key] && (draft[e.key].visible !== e.defaultVisible || draft[e.key].access !== e.defaultAccess))
        .map((e) => ({ key: e.key, ...draft[e.key] }));
      return adminMenuApi.saveOverrides(overrides);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'menu'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });
  useCtrlS(hasChanges && !saveMutation.isPending, () => saveMutation.mutate());

  const setEntry = (key: string, patch: Partial<{ visible: boolean; access: MenuAccess }>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const resetEntry = (e: AdminMenuEntry) => setEntry(e.key, { visible: e.defaultVisible, access: e.defaultAccess });
  const resetAll = () => setDraft(Object.fromEntries((data ?? []).map((e) => [e.key, { visible: e.defaultVisible, access: e.defaultAccess }])));

  const sections = useMemo(() => {
    const wanted = TABS.find((t) => t.id === tab)!.sections as readonly string[];
    const groups = new Map<string, { label: string; order: number; entries: AdminMenuEntry[] }>();
    for (const e of data ?? []) {
      if (!wanted.includes(e.section)) continue;
      if (!groups.has(e.section)) groups.set(e.section, { label: e.sectionLabel, order: e.sectionOrder, entries: [] });
      groups.get(e.section)!.entries.push(e);
    }
    return [...groups.values()].sort((a, b) => a.order - b.order).map((g) => ({ ...g, entries: g.entries.sort((a, b) => a.order - b.order) }));
  }, [data, tab]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Configuration des vues</h1>
              <PageHelpButton pageKey="admin-views" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{pageHint('admin-views', 'intro')}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <HelpHint text={pageHint('admin-views', 'resetAll')}>
              <Button variant="bordered" onClick={resetAll} disabled={!data}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Tout réinitialiser
              </Button>
            </HelpHint>
            <HelpHint text={pageHint('admin-views', 'save')}>
              <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-tour="admin-views-save">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
            </HelpHint>
          </div>
        </div>
        <div className="flex gap-1 border-b border-border" data-tour="admin-views-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {saveMutation.isError && <p className="mt-2 text-sm text-destructive">L'enregistrement a échoué. Réessayez.</p>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement…</div>
      ) : (
        <div className="mt-4 space-y-6" data-tour="admin-views-list">
          {sections.map((section) => (
            <div key={section.label}>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">{section.label}</h2>
              <div className="bg-card border rounded-lg divide-y divide-border">
                {section.entries.map((e) => {
                  const cur = draft[e.key] ?? { visible: e.visible, access: e.access };
                  const isDefault = cur.visible === e.defaultVisible && cur.access === e.defaultAccess;
                  return (
                    <div key={e.key} className={`flex items-center gap-3 px-4 py-2 ${cur.visible ? '' : 'opacity-60'}`}>
                      <HelpHint text={pageHint('admin-views', 'visible')}>
                        <button
                          type="button"
                          onClick={() => setEntry(e.key, { visible: !cur.visible })}
                          aria-label={cur.visible ? `Masquer ${e.label}` : `Afficher ${e.label}`}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                        >
                          {cur.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </HelpHint>
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">{e.label}</span>
                      {!isDefault && (
                        <HelpHint text={`${pageHint('admin-views', 'modified')} : ${e.defaultVisible ? 'visible' : 'masquée'}, ${ACCESS_LABELS[e.defaultAccess]}.`}>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">modifié</span>
                        </HelpHint>
                      )}
                      <HelpHint text={pageHint('admin-views', 'access')}>
                        <div className="w-32">
                          <Select
                            value={cur.access}
                            onChange={(ev) => setEntry(e.key, { access: ev.target.value as MenuAccess })}
                            options={ACCESS_OPTIONS}
                            aria-label={`Accès à ${e.label}`}
                          />
                        </div>
                      </HelpHint>
                      <HelpHint text={pageHint('admin-views', 'resetRow')}>
                        <button
                          type="button"
                          onClick={() => resetEntry(byKey.get(e.key)!)}
                          disabled={isDefault}
                          aria-label={`Revenir au réglage du code pour ${e.label}`}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </HelpHint>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

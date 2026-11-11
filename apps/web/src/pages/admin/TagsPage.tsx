/* Admin tags (/admin/tags, décision Thomas 2026-11-11) : tags globaux (proposés dans tous les espaces) et doublons de
   tags entre communautés et global. Portée côté API : apps/api/src/utils/tagScope.ts ; routes : routes/admin/tags.ts.
   - Onglet « Tous les tags » : créer un tag global, filtrer par portée / nom, renommer et recolorer, « Rendre global »,
     supprimer (confirmation, irréversible : le tag est retiré de tous ses éléments).
   - Onglet « Doublons » : tags de même nom (sans casse) ; on choisit le tag gardé, « Fusionner » reporte les éléments
     des autres sur lui puis les supprime. Une cible n'est proposée que si elle est visible depuis tous les éléments
     (global, ou communauté de tous les éléments) — l'API refuse sinon ; un ancien tag d'espace n'est jamais une cible.
   Aide utilisateur : fiche pages/help/admin-tags.help.ts — « ? » (PageHelpButton), rappels fonctionnels (pageHint),
   phrase d'explication visible sous le titre des doublons (bloc de décision). */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, RefreshCw, Globe, Trash2, Pencil, Check, X, Merge, Plus } from 'lucide-react';
import type { Tag } from '@spok/shared';
import { adminApi, type AdminTag } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { TagBadge } from '../../components/ui/TagBadge';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageHelpButton } from '../../help/PageHelpButton';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

type TabKey = 'all' | 'duplicates';
type ScopeFilter = 'all' | AdminTag['scope'];
type DuplicateTag = AdminTag & { communityIds: Array<string | null> };

const SCOPE_LABEL: Record<AdminTag['scope'], string> = { global: 'Global', community: 'Communauté', space: 'Espace (ancien)' };

function scopeDetail(tag: AdminTag): string {
  if (tag.scope === 'community') return tag.communityName ?? tag.communityId ?? '';
  if (tag.scope === 'space') return tag.spaceName ?? tag.spaceId ?? '';
  return 'Tous les espaces';
}

const badgeTag = (t: AdminTag) => ({ id: t.id, name: t.name, color: t.color }) as Tag;

/** La cible est visible depuis tous les éléments des autres tags du groupe (même règle que POST /admin/tags/merge) */
export function canBeMergeTarget(target: DuplicateTag, group: DuplicateTag[]): boolean {
  if (target.scope === 'global') return true;
  if (target.scope !== 'community') return false;
  return group.filter((t) => t.id !== target.id).every((t) => t.communityIds.every((c) => c === target.communityId));
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Erreur');

export function TagsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminTag | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<{ key: string; target: DuplicateTag; sources: DuplicateTag[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({ queryKey: ['admin', 'tags'], queryFn: () => adminApi.tags.list() });
  const dupQuery = useQuery({ queryKey: ['admin', 'tags', 'duplicates'], queryFn: () => adminApi.tags.duplicates() });

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
    // Listes de tags des espaces (sélecteur de la fiche) : un tag global ou fusionné change partout
    queryClient.invalidateQueries({ queryKey: ['tags'] });
  };
  const onError = (e: unknown) => setError(errorText(e));

  const createMutation = useMutation({
    mutationFn: () => adminApi.tags.create({ name: newName.trim(), color: newColor }),
    onSuccess: () => { setNewName(''); refresh(); },
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: (e: { id: string; name: string; color: string }) => adminApi.tags.update(e.id, { name: e.name.trim(), color: e.color }),
    onSuccess: () => { setEditing(null); refresh(); },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.tags.delete(id),
    onSuccess: () => { setDeleting(null); refresh(); },
    onError: (e) => { setDeleting(null); onError(e); },
  });
  const promoteMutation = useMutation({
    mutationFn: (id: string) => adminApi.tags.promote(id),
    onSuccess: refresh,
    onError,
  });
  const mergeMutation = useMutation({
    mutationFn: (m: { target: DuplicateTag; sources: DuplicateTag[] }) => adminApi.tags.merge(m.target.id, m.sources.map((s) => s.id)),
    onSuccess: () => { setMerging(null); refresh(); },
    onError: (e) => { setMerging(null); onError(e); },
  });

  const tags = listQuery.data ?? [];
  const groups = dupQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tags.filter((t) => (scopeFilter === 'all' || t.scope === scopeFilter) && (!q || t.name.toLowerCase().includes(q)));
  }, [tags, scopeFilter, search]);
  const isFetching = listQuery.isFetching || dupQuery.isFetching;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TagIcon className="w-6 h-6 text-primary" />
            Tags
            <PageHelpButton pageKey="admin-tags" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tags globaux (proposés dans tous les espaces) et tags des communautés ; fusion des doublons
          </p>
        </div>
        <HelpHint text={pageHint('admin-tags', 'refresh')}>
          <Button variant="bordered" size="sm" onClick={refresh} disabled={isFetching} className="gap-2" data-tour="admin-tags-refresh">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </HelpHint>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border" data-tour="admin-tags-tabs" data-help-zone="admin-tags:onglets">
        {([['all', 'Tous les tags', tags.length], ['duplicates', 'Doublons', groups.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {count > 0 && <span className="text-xs rounded-full px-1.5 py-0.5 font-mono bg-muted text-muted-foreground">{count}</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400 flex items-center justify-between gap-2">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Fermer le message"><X className="w-4 h-4" /></button>
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-4">
          <form
            className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border bg-card"
            data-tour="admin-tags-create"
            data-help-zone="admin-tags:creer"
            onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du tag global"
              className="flex-1 min-w-[12rem] px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} aria-label="Couleur du tag" className="w-9 h-8 rounded border border-border" />
            <HelpHint text={pageHint('admin-tags', 'create')}>
              <Button type="submit" size="sm" disabled={!newName.trim() || createMutation.isPending} className="gap-1">
                <Plus className="w-4 h-4" /> Créer un tag global
              </Button>
            </HelpHint>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
              aria-label="Portée"
              className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
            >
              <option value="all">Toutes les portées</option>
              <option value="global">Globaux</option>
              <option value="community">Communautés</option>
              <option value="space">Espaces (anciens)</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un tag"
              className="flex-1 min-w-[10rem] px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
          </div>

          <div className="rounded-lg border border-border divide-y divide-border" data-tour="admin-tags-list" data-help-zone="admin-tags:liste">
            {listQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Chargement…</p>}
            {!listQuery.isLoading && filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun tag.</p>}
            {filtered.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 px-3 py-2 flex-wrap">
                {editing?.id === tag.id ? (
                  <form
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onSubmit={(e) => { e.preventDefault(); if (editing.name.trim()) updateMutation.mutate(editing); }}
                  >
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      aria-label="Nom du tag"
                      className="flex-1 min-w-0 px-2 py-1 text-sm rounded-md border border-border bg-background"
                    />
                    <input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} aria-label="Couleur du tag" className="w-9 h-7 rounded border border-border" />
                    <Button type="submit" size="sm" variant="bordered" aria-label="Enregistrer le tag" disabled={updateMutation.isPending}><Check className="w-4 h-4" /></Button>
                    <Button type="button" size="sm" variant="ghost" aria-label="Annuler" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <TagBadge tag={badgeTag(tag)} />
                      <span className="text-xs text-muted-foreground">{SCOPE_LABEL[tag.scope]} · {scopeDetail(tag)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{tag.itemCount} élément{tag.itemCount > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1">
                      <HelpHint text={pageHint('admin-tags', 'edit')}>
                        <Button size="sm" variant="ghost" aria-label="Renommer ou recolorer" onClick={() => setEditing({ id: tag.id, name: tag.name, color: tag.color ?? '#6366f1' })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </HelpHint>
                      {tag.scope !== 'global' && (
                        <HelpHint text={pageHint('admin-tags', 'promote')}>
                          <Button size="sm" variant="ghost" aria-label="Rendre global" disabled={promoteMutation.isPending} onClick={() => promoteMutation.mutate(tag.id)}>
                            <Globe className="w-4 h-4" />
                          </Button>
                        </HelpHint>
                      )}
                      <HelpHint text={pageHint('admin-tags', 'delete')}>
                        <Button size="sm" variant="ghost" aria-label="Supprimer le tag" onClick={() => setDeleting(tag)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </HelpHint>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="space-y-4" data-tour="admin-tags-duplicates" data-help-zone="admin-tags:doublons">
          <p className="text-sm text-muted-foreground">{pageHint('admin-tags', 'duplicatesIntro')}</p>
          {dupQuery.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!dupQuery.isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">Aucun doublon de tag.</p>}
          {groups.map((group) => {
            const valid = group.tags.filter((t) => canBeMergeTarget(t, group.tags));
            const chosenId = targets[group.key] ?? valid[0]?.id;
            const chosen = group.tags.find((t) => t.id === chosenId && valid.includes(t));
            return (
              <div key={group.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-sm font-semibold">« {group.key} » — {group.tags.length} tags</div>
                <div className="space-y-1">
                  {group.tags.map((tag) => {
                    const ok = valid.includes(tag);
                    return (
                      <label key={tag.id} className={`flex items-center gap-3 px-2 py-1 rounded ${ok ? 'cursor-pointer hover:bg-muted' : 'opacity-60'}`}>
                        <input
                          type="radio"
                          name={`keep-${group.key}`}
                          disabled={!ok}
                          checked={chosen?.id === tag.id}
                          onChange={() => setTargets({ ...targets, [group.key]: tag.id })}
                        />
                        <TagBadge tag={badgeTag(tag)} />
                        <span className="text-xs text-muted-foreground flex-1">{SCOPE_LABEL[tag.scope]} · {scopeDetail(tag)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{tag.itemCount} élément{tag.itemCount > 1 ? 's' : ''}</span>
                        {!ok && <span className="text-xs text-muted-foreground">ne peut pas être gardé</span>}
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <HelpHint text={pageHint('admin-tags', 'merge')}>
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={!chosen || mergeMutation.isPending}
                      onClick={() => chosen && setMerging({ key: group.key, target: chosen, sources: group.tags.filter((t) => t.id !== chosen.id) })}
                    >
                      <Merge className="w-4 h-4" /> Fusionner dans le tag choisi
                    </Button>
                  </HelpHint>
                  {!chosen && <span className="text-xs text-muted-foreground">{pageHint('admin-tags', 'noTarget')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Supprimer le tag"
        message={deleting ? `Supprimer « ${deleting.name} » (${SCOPE_LABEL[deleting.scope]}) ? Il sera retiré de ${deleting.itemCount} élément(s).` : ''}
        warning="Irréversible : le tag et ses associations ne peuvent pas être restaurés."
        confirmLabel="Supprimer"
        confirmVariant="destructive"
        isPending={deleteMutation.isPending}
      />
      <ConfirmModal
        isOpen={!!merging}
        onClose={() => setMerging(null)}
        onConfirm={() => merging && mergeMutation.mutate(merging)}
        title="Fusionner les tags"
        message={merging
          ? `Les éléments de ${merging.sources.map((s) => `« ${s.name} » (${SCOPE_LABEL[s.scope]})`).join(', ')} recevront « ${merging.target.name} » (${SCOPE_LABEL[merging.target.scope]}), puis ces tags seront supprimés.`
          : ''}
        warning="Irréversible : les tags fusionnés ne peuvent pas être recréés depuis l'interface."
        confirmLabel="Fusionner"
        isPending={mergeMutation.isPending}
      />
    </div>
  );
}

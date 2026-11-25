/* Fenêtre « Déplacer le tag » de /admin/tags (demandes Thomas 2026-11-18 et 2026-11-25) : choisir la destination d'un
 * tag — une communauté (le tag y est proposé dans tous les espaces : le rendre à sa communauté ou l'envoyer vers une
 * autre) ou un espace (proposé dans l'espace et ses sous-espaces) — POST /admin/tags/:id/move.
 * Recherche par nom : communautés en tête (GET /admin/communities?search=, 20 premières), puis espaces
 * (GET /admin/spaces?search=, 50 premiers) avec leur communauté et leur parent ; la portée actuelle est exclue.
 * Bloc de décision : bilan de la destination choisie (GET /admin/tags/:id/move-preview) — éléments qui portent le tag hors
 * de la nouvelle portée ; ils garderont un tag du même nom dans leur espace (rien n'est perdu). Refus 409 de l'API (tag de
 * même nom déjà proposé à la destination : fusionner) affiché dans la fenêtre.
 * Textes d'aide : fiche pages/help/admin-tags.help.ts (hints moveIntro, moveOutside, moveNone).
 * Props : tag (null = fermée), onClose, onMoved (après succès, l'appelant rafraîchit les listes).
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FolderInput, Search, Users } from 'lucide-react';
import type { Tag } from '@spok/shared';
import { adminApi, type AdminTag } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TagBadge } from '../../components/ui/TagBadge';
import { pageHint } from '../../help/pageHint';

interface MoveTagModalProps {
  tag: AdminTag | null;
  onClose: () => void;
  onMoved: () => void;
}

type Dest = { kind: 'space' | 'community'; id: string; name: string };
const destBody = (d: Dest) => (d.kind === 'space' ? { spaceId: d.id } : { communityId: d.id });

export function MoveTagModal({ tag, onClose, onMoved }: MoveTagModalProps) {
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<Dest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = search.trim() || undefined;

  const communitiesQuery = useQuery({
    queryKey: ['admin', 'communities', 'tag-move', q],
    queryFn: () => adminApi.communities.list({ search: q, pageSize: 20 }),
    enabled: !!tag,
  });
  const spacesQuery = useQuery({
    queryKey: ['admin', 'spaces', 'tag-move', q],
    queryFn: () => adminApi.spaces.list({ search: q, pageSize: 50 }),
    enabled: !!tag,
  });
  const previewQuery = useQuery({
    queryKey: ['admin', 'tags', 'move-preview', tag?.id, target?.kind, target?.id],
    queryFn: () => adminApi.tags.movePreview(tag!.id, destBody(target!)),
    enabled: !!tag && !!target,
  });

  const communities = (communitiesQuery.data?.data ?? []).filter((c) => c.id !== tag?.communityId);
  const spaces = (spacesQuery.data?.data ?? []).filter((s) => s.id !== tag?.spaceId);
  const loading = communitiesQuery.isLoading || spacesQuery.isLoading;

  const close = () => { setSearch(''); setTarget(null); setError(null); onClose(); };
  const move = useMutation({
    mutationFn: () => adminApi.tags.move(tag!.id, destBody(target!)),
    onSuccess: () => { close(); onMoved(); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Déplacement refusé'),
  });

  const pick = (d: Dest) => { setTarget(d); setError(null); };
  const row = (d: Dest, sub: string) => (
    <button
      key={`${d.kind}-${d.id}`}
      type="button"
      role="radio"
      aria-checked={target?.kind === d.kind && target.id === d.id}
      onClick={() => pick(d)}
      className={`w-full text-left px-3 py-2 text-sm transition-colors ${target?.kind === d.kind && target.id === d.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'}`}
    >
      <span className="flex items-center gap-1.5">{d.kind === 'community' && <Users className="w-3.5 h-3.5 text-muted-foreground" />}{d.name}</span>
      <span className="block text-xs text-muted-foreground font-normal">{sub}</span>
    </button>
  );

  const preview = previewQuery.data;

  return (
    <Modal isOpen={!!tag} onClose={close} title="Déplacer le tag" size="default" devName="MoveTagModal">
      {tag && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <TagBadge tag={{ id: tag.id, name: tag.name, color: tag.color } as Tag} />
            <span className="text-muted-foreground">
              {tag.itemCount} élément{tag.itemCount > 1 ? 's' : ''} · actuellement {tag.scope === 'space' ? `espace « ${tag.spaceName} »` : tag.scope === 'community' ? `communauté « ${tag.communityName} »` : 'global'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{pageHint('admin-tags', 'moveIntro')}</p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setTarget(null); }}
              placeholder="Rechercher une communauté ou un espace"
              className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border" role="radiogroup" aria-label="Destination">
            {loading && <p className="p-3 text-sm text-muted-foreground">Chargement…</p>}
            {!loading && communities.length + spaces.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune communauté ni aucun espace.</p>}
            {communities.map((c) => row({ kind: 'community', id: c.id, name: c.name }, 'Communauté : proposé dans tous ses espaces'))}
            {spaces.map((s) => row(
              { kind: 'space', id: s.id, name: s.name },
              `Espace · ${s.community?.name ?? 'Sans communauté'}${s.parent ? ` › ${s.parent.name}` : ''}`,
            ))}
          </div>
          {target && (
            <p className="text-sm rounded-md border border-border bg-muted/40 px-3 py-2" data-tour="admin-tags-move-preview">
              {previewQuery.isLoading && 'Calcul du bilan…'}
              {previewQuery.error && <span className="text-red-600 dark:text-red-400">{(previewQuery.error as Error).message}</span>}
              {preview && preview.outsideCount === 0 && pageHint('admin-tags', 'moveNone')}
              {preview && preview.outsideCount > 0 && (
                <>
                  <strong>{preview.outsideCount} élément{preview.outsideCount > 1 ? 's' : ''}</strong> hors de « {target.name} » ({preview.spaces.join(', ')}).{' '}
                  {pageHint('admin-tags', 'moveOutside')}
                </>
              )}
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="bordered" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" className="gap-1" disabled={!target || !preview || move.isPending} onClick={() => move.mutate()}>
              <FolderInput className="w-4 h-4" /> Déplacer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

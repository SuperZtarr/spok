/* Fenêtre « Déplacer vers un espace » de /admin/tags (demande Thomas 2026-11-18) : choisir l'espace cible d'un tag, qui
 * devient un tag de cet espace (proposé dans l'espace et ses sous-espaces) — POST /admin/tags/:id/move.
 * Recherche des espaces par nom (GET /admin/spaces?search=, 50 premiers), affichés avec leur communauté et leur parent.
 * Refus de l'API affiché dans la fenêtre : éléments portant le tag hors de l'espace (nombre et espaces), ou tag de même
 * nom déjà visible depuis la cible (fusionner plutôt). Textes d'aide : fiche pages/help/admin-tags.help.ts (hints move*).
 * Props : tag (null = fermée), onClose, onMoved (après succès, l'appelant rafraîchit les listes).
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FolderInput, Search } from 'lucide-react';
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

export function MoveTagModal({ tag, onClose, onMoved }: MoveTagModalProps) {
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spacesQuery = useQuery({
    queryKey: ['admin', 'spaces', 'tag-move', search.trim()],
    queryFn: () => adminApi.spaces.list({ search: search.trim() || undefined, pageSize: 50 }),
    enabled: !!tag,
  });
  const spaces = (spacesQuery.data?.data ?? []).filter((s) => s.id !== tag?.spaceId);

  const close = () => { setSearch(''); setTargetId(null); setError(null); onClose(); };
  const move = useMutation({
    mutationFn: () => adminApi.tags.move(tag!.id, targetId!),
    onSuccess: () => { close(); onMoved(); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Déplacement refusé'),
  });

  return (
    <Modal isOpen={!!tag} onClose={close} title="Déplacer le tag vers un espace" size="default" devName="MoveTagModal">
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
              onChange={(e) => { setSearch(e.target.value); setTargetId(null); }}
              placeholder="Rechercher un espace"
              className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border" role="radiogroup" aria-label="Espace cible">
            {spacesQuery.isLoading && <p className="p-3 text-sm text-muted-foreground">Chargement…</p>}
            {!spacesQuery.isLoading && spaces.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucun espace.</p>}
            {spaces.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={targetId === s.id}
                onClick={() => { setTargetId(s.id); setError(null); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${targetId === s.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'}`}
              >
                {s.name}
                <span className="block text-xs text-muted-foreground font-normal">
                  {s.community?.name ?? 'Sans communauté'}{s.parent ? ` › ${s.parent.name}` : ''}
                </span>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="bordered" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" className="gap-1" disabled={!targetId || move.isPending} onClick={() => move.mutate()}>
              <FolderInput className="w-4 h-4" /> Déplacer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

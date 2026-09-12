/*
 * Modale "Insérer un modèle" : liste les ItemTemplate disponibles (portée globale, recherche),
 * optionnellement un sélecteur de parent, et crée l'arborescence complète en un appel.
 * Ouverte depuis SpaceToolbar (racine de l'espace) et ItemEditModal (comme enfant de l'item ouvert).
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, LayoutTemplate, Search, Trash2 } from 'lucide-react';
import { itemTemplatesApi } from '../lib/api';
import { countTemplateNodes } from './item-edit-helpers';
import { useAuthStore } from '../stores/auth';
import type { Item } from '@spok/shared';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface InsertTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  allItems: Item[];
  /** Item sous lequel insérer (child) ; absent = insertion à la racine de l'espace. */
  defaultParentId?: string | null;
  onCreated: (rootItemId: string) => void;
}

export function InsertTemplateModal({ isOpen, onClose, spaceId, allItems, defaultParentId, onCreated }: InsertTemplateModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [parentId, setParentId] = useState(defaultParentId || '');

  const { data: templates } = useQuery({
    queryKey: ['item-templates'],
    queryFn: () => itemTemplatesApi.list(),
    enabled: isOpen,
  });

  const filtered = useMemo(() => {
    const list = templates || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [templates, search]);

  const parentOptions = useMemo(() => [
    { value: '', label: 'Aucun parent (racine)' },
    ...[...allItems].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })).map((i) => ({ value: i.id, label: i.title })),
  ], [allItems]);

  const createMutation = useMutation({
    mutationFn: (templateId: string) => itemTemplatesApi.createFromTemplate(spaceId, { templateId, parentId: parentId || undefined }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      onCreated(created.id);
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemTemplatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-templates'] }),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate className="w-4 h-4" />
            Insérer un modèle
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Rechercher un modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Parent</label>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-sm text-center text-muted-foreground">Aucun modèle. Crée-en un depuis un item existant ("Enregistrer comme modèle").</p>
          )}
          {filtered.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors group">
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(tpl.id)}
              >
                <div className="text-sm font-medium truncate">{tpl.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {countTemplateNodes(tpl.structure)} élément{countTemplateNodes(tpl.structure) > 1 ? 's' : ''}
                  {tpl.description ? ` — ${tpl.description}` : ''}
                </div>
              </button>
              {tpl.createdById === user?.id && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  title="Supprimer ce modèle"
                  onClick={() => deleteMutation.mutate(tpl.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border flex-shrink-0">
          <Button type="button" variant="bordered" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

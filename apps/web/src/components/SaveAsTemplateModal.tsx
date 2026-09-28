/*
 * Modale "Enregistrer comme modèle" : capture un item existant + ses descendants (titre+type,
 * récursif) et les sauvegarde comme ItemTemplate réutilisable (portée globale — visible par
 * tous les utilisateurs). Ouverte depuis la barre d'actions d'ItemEditModal.
 * Nom pré-rempli avec le titre de l'item à chaque ouverture (pas seulement au montage).
 */
import { useEffect, useState, useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, LayoutTemplate } from 'lucide-react';
import { itemTemplatesApi } from '../lib/api';
import { buildItemTemplateStructure, countTemplateNodes } from './item-edit-helpers';
import type { Item } from '@spok/shared';
import { Button } from './ui/Button';
import { DevModalBadge } from './ui/DevModalBadge';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  allItems: Item[];
}

export function SaveAsTemplateModal({ isOpen, onClose, itemId, allItems }: SaveAsTemplateModalProps) {
  const queryClient = useQueryClient();
  const item = allItems.find((i) => i.id === itemId);
  const [name, setName] = useState(item?.title || '');
  const [description, setDescription] = useState('');

  // Pré-remplissage à CHAQUE ouverture (fermé → ouvert) avec le titre courant : la modale est montée
  // fermée avec ItemEditModal, souvent avant le chargement d'allItems (lien direct après reload) —
  // l'initialiseur du useState laissait alors le nom vide.
  const itemTitle = item?.title;
  useEffect(() => {
    if (!isOpen) return;
    setName(itemTitle || '');
    setDescription('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- uniquement à l'ouverture, ne pas écraser la saisie

  const structure = isOpen ? buildItemTemplateStructure(itemId, allItems) : null;
  const nodeCount = structure ? countTemplateNodes(structure) : 0;

  const saveMutation = useMutation({
    mutationFn: () => itemTemplatesApi.create({ name: name.trim(), description: description.trim() || undefined, structure: structure! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates'] });
      onClose();
    },
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div ref={dialogRef} className="outline-none w-full max-w-md rounded-xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate className="w-4 h-4" />
            Enregistrer comme modèle
            <DevModalBadge name="SaveAsTemplateModal" />
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-2 text-xs text-muted-foreground">
          {nodeCount > 1 ? `${nodeCount} éléments seront capturés` : `${nodeCount} élément sera capturé`} (titre + type uniquement).
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom du modèle</label>
            <input
              className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description (optionnel)</label>
            <textarea
              className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="bordered" size="sm" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

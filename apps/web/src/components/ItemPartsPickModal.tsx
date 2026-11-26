/*
 * Modale de choix, une ligne par partie, avant « Éclater en sous-éléments » ou « Absorber les enfants »
 * (demande Thomas 2026-11-26 : confirmer partie par partie au lieu d'une exécution immédiate).
 * - mode 'split' : une ligne par titre de niveau 2 ou 3 de la description, lue par splitDescriptionSections (@spok/shared,
 *   même découpage que l'API) ; les sections non cochées restent dans la description.
 * - mode 'absorb' : une ligne par enfant direct (childItems, déjà triés) ; les enfants non cochés restent enfants.
 * Tout est coché à l'ouverture ; le bouton de confirmation est désactivé si rien n'est coché.
 * Props : mode, itemId + itemSpaceId (fiche relue pour la description), itemTitle, childItems (absorb),
 * onConfirm(indices de sections | ids d'enfants), isPending. L'appel API reste dans useSpaceActions.
 * Aide : fiche components/help/item-parts-pick.help.ts (« ? », zones liste / tout, rappels pageHint).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item } from '@spok/shared';
import { splitDescriptionSections } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { itemsApi } from '../lib/api';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';

export type ItemPartsMode = 'split' | 'absorb';

interface ItemPartsPickModalProps {
  mode: ItemPartsMode | null;
  itemId: string | null;
  itemSpaceId: string;
  itemTitle?: string;
  /** Enfants directs de l'élément, dans l'ordre (mode absorb). */
  childItems: Item[];
  onClose: () => void;
  /** split : indices des sections cochées ; absorb : ids des enfants cochés. */
  onConfirm: (selection: number[] | string[]) => void;
  isPending?: boolean;
}

interface PartRow {
  key: string;
  title: string;
  preview: string;
}

/** Début du texte d'une partie, sans balises, pour reconnaître la section ou l'enfant. */
function textPreview(html?: string | null): string {
  const text = (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function ItemPartsPickModal({
  mode, itemId, itemSpaceId, itemTitle, childItems, onClose, onConfirm, isPending,
}: ItemPartsPickModalProps) {
  const isOpen = !!mode && !!itemId;
  const isSplit = mode === 'split';

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', itemSpaceId, itemId],
    queryFn: () => itemsApi.get(itemSpaceId, itemId!),
    enabled: isOpen && isSplit,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const rows: PartRow[] = useMemo(() => {
    if (isSplit) {
      return splitDescriptionSections(item?.description).sections.map((s, i) => ({
        key: String(i), title: s.title || 'Sans titre', preview: textPreview(s.body),
      }));
    }
    return childItems.map((c) => ({ key: c.id, title: c.title || 'Sans titre', preview: textPreview(c.description) }));
  }, [isSplit, item?.description, childItems]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const rowKeys = rows.map((r) => r.key).join('|');
  // Tout coché à l'ouverture et quand la liste change (fiche relue)
  useEffect(() => { setChecked(new Set(rows.map((r) => r.key))); }, [rowKeys, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allChecked = rows.length > 0 && checked.size === rows.length;

  const confirm = () => {
    const keys = rows.filter((r) => checked.has(r.key)).map((r) => r.key);
    onConfirm(isSplit ? keys.map(Number) : keys);
  };

  const count = rows.filter((r) => checked.has(r.key)).length;
  const confirmLabel = isSplit
    ? `Éclater ${count} section${count > 1 ? 's' : ''}`
    : `Absorber ${count} sous-élément${count > 1 ? 's' : ''}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSplit ? 'Éclater en sous-éléments' : 'Absorber les sous-éléments'}
      devName="ItemPartsPickModal"
    >
      <div className="flex justify-end -mt-2 mb-1"><PageHelpButton pageKey="item-parts-pick" /></div>
      <div className="space-y-3">
        {itemTitle && <div className="p-3 bg-muted rounded-md font-semibold truncate">{itemTitle}</div>}
        <p className="text-sm text-muted-foreground">
          {pageHint('item-parts-pick', isSplit ? 'introSplit' : 'introAbsorb')}
        </p>

        <div className="flex justify-end" data-help-zone="item-parts-pick:tout">
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={rows.length === 0}
            onClick={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.key)))}
          >
            {allChecked ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y" data-help-zone="item-parts-pick:liste">
          {isSplit && isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {pageHint('item-parts-pick', isSplit ? 'emptySplit' : 'emptyAbsorb')}
            </p>
          ) : rows.map((r) => (
            <label key={r.key} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                className="mt-1"
                checked={checked.has(r.key)}
                onChange={() => toggle(r.key)}
              />
              <span className="min-w-0">
                <span className="block font-medium truncate">{r.title}</span>
                {r.preview && <span className="block text-xs text-muted-foreground line-clamp-2">{r.preview}</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="bordered" onClick={onClose}>Annuler</Button>
          <HelpHint text={pageHint('item-parts-pick', isSplit ? 'confirmSplit' : 'confirmAbsorb')}>
            <Button onClick={confirm} disabled={count === 0 || !!isPending}>{confirmLabel}</Button>
          </HelpHint>
        </div>
      </div>
    </Modal>
  );
}

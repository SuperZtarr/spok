/*
 * Modale de choix, partie par partie, avant « Éclater en sous-éléments » ou « Absorber les enfants »
 * (demande Thomas 2026-11-26 : confirmer partie par partie au lieu d'une exécution immédiate).
 * - mode 'split' (premier niveau H2, demande Thomas 2026-11-27) : sections lues par splitDescriptionSections
 *   (@spok/shared, même découpage que l'API).
 *   · une ligne par H2, cochée à l'ouverture : cochée = sous-élément, décochée = reste dans la description ;
 *   · sous chaque H2, ses H3 en retrait, décochés à l'ouverture : coché = sous-élément de son H2, décoché = reste dans la
 *     description du H2 ; case grisée si le H2 est décoché ;
 *   · bloc Contenus (si l'élément en a) : une destination par contenu, « Reste sur l'élément » par défaut ou l'un des
 *     sous-éléments cochés ; une destination devenue décochée revient à « Reste ». Données sécurisées : jamais listées.
 * - mode 'absorb' : une ligne par enfant direct (childItems, déjà triés) ; les enfants non cochés restent enfants.
 * Le bouton de confirmation est désactivé si rien n'est coché.
 * Props : mode, itemId + itemSpaceId (fiche relue pour la description et les contenus), itemTitle, childItems (absorb),
 * onConfirm(DescriptionSplitRequest | ids d'enfants), isPending. L'appel API reste dans useSpaceActions.
 * Aide : fiche components/help/item-parts-pick.help.ts (« ? », zones liste / tout / sous-titres / contenus, rappels pageHint).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DescriptionSplitRequest, Item } from '@spok/shared';
import { splitDescriptionSections, sortItemContents, itemContentKindDef } from '@spok/shared';
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
  /** split : H2 / H3 cochés et destination des contenus ; absorb : ids des enfants cochés. */
  onConfirm: (selection: DescriptionSplitRequest | string[]) => void;
  isPending?: boolean;
}

/** Début du texte d'une partie, sans balises, pour reconnaître la section ou l'enfant. */
function textPreview(html?: string | null): string {
  const text = (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** Clé d'un sous-élément : « i » pour un H2, « i.j » pour un H3 ; '' = reste sur l'élément (contenus). */
const subKey = (i: number, j: number) => `${i}.${j}`;

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

  // ── Éclater : H2, H3, contenus ──
  const sections = useMemo(() => splitDescriptionSections(item?.description).sections, [item?.description]);
  const contents = useMemo(() => sortItemContents(item?.contents ?? []), [item?.contents]);
  const [h2, setH2] = useState<Set<number>>(new Set());
  const [h3, setH3] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Record<string, string>>({});
  const splitKey = `${item?.id}|${item?.description}`;
  // Ouverture ou fiche relue : tous les H2, aucun H3, contenus laissés sur l'élément
  useEffect(() => {
    setH2(new Set(sections.map((_, i) => i)));
    setH3(new Set());
    setTargets({});
  }, [splitKey, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIn = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  };
  /** H3 réellement éclatés : cochés ET dont le H2 l'est. */
  const activeH3 = useMemo(
    () => sections.flatMap((s, i) => (h2.has(i) ? s.subsections.map((_, j) => subKey(i, j)).filter((k) => h3.has(k)) : [])),
    [sections, h2, h3],
  );
  /** Destinations proposées aux contenus : sous-éléments qui seront créés, dans l'ordre. */
  const destinations = useMemo(() => sections.flatMap((s, i) => (!h2.has(i) ? [] : [
    { key: String(i), label: s.title || 'Sans titre' },
    ...s.subsections.map((sub, j) => ({ key: subKey(i, j), label: `— ${sub.title || 'Sans titre'}` }))
      .filter((d) => h3.has(d.key)),
  ])), [sections, h2, h3]);
  const destinationKeys = new Set(destinations.map((d) => d.key));
  const effectiveTarget = (contentId: string) => (destinationKeys.has(targets[contentId] ?? '') ? targets[contentId] : '');
  const allH3Keys = sections.flatMap((s, i) => (h2.has(i) ? s.subsections.map((_, j) => subKey(i, j)) : []));
  const allH3Checked = allH3Keys.length > 0 && allH3Keys.every((k) => h3.has(k));

  const confirmSplit = () => {
    const movedContents = contents.flatMap((c) => {
      const target = effectiveTarget(c.id);
      if (!target) return [];
      const [section, subsection] = target.split('.').map(Number);
      return [{ contentId: c.id, section, ...(subsection === undefined ? {} : { subsection }) }];
    });
    onConfirm({
      sections: [...h2].sort((a, b) => a - b),
      subsections: activeH3.map((k) => k.split('.').map(Number) as [number, number]),
      contents: movedContents,
    });
  };

  // ── Absorber : enfants directs ──
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const childKeys = childItems.map((c) => c.id).join('|');
  useEffect(() => { setChecked(new Set(childItems.map((c) => c.id))); }, [childKeys, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const allChildrenChecked = childItems.length > 0 && checked.size === childItems.length;

  // ── Pied commun ──
  const count = isSplit ? h2.size + activeH3.length : childItems.filter((c) => checked.has(c.id)).length;
  const movedCount = isSplit ? contents.filter((c) => effectiveTarget(c.id)).length : 0;
  const confirmLabel = isSplit
    ? `Éclater : ${count} sous-élément${count > 1 ? 's' : ''}${movedCount > 0 ? `, ${movedCount} contenu${movedCount > 1 ? 's' : ''} déplacé${movedCount > 1 ? 's' : ''}` : ''}`
    : `Absorber ${count} sous-élément${count > 1 ? 's' : ''}`;
  const rowCount = isSplit ? sections.length : childItems.length;
  const allChecked = isSplit ? sections.length > 0 && h2.size === sections.length : allChildrenChecked;
  const toggleAll = () => {
    if (isSplit) setH2(allChecked ? new Set() : new Set(sections.map((_, i) => i)));
    else setChecked(allChecked ? new Set() : new Set(childItems.map((c) => c.id)));
  };

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

        <div className="flex justify-end gap-4">
          {isSplit && allH3Keys.length > 0 && (
            <HelpHint text={pageHint('item-parts-pick', 'subsectionsSplit')}>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                data-help-zone="item-parts-pick:sous-titres"
                onClick={() => setH3(allH3Checked ? new Set() : new Set(allH3Keys))}
              >
                {allH3Checked ? 'Garder les sous-titres dans le texte' : 'Éclater tous les sous-titres'}
              </button>
            </HelpHint>
          )}
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            data-help-zone="item-parts-pick:tout"
            disabled={rowCount === 0}
            onClick={toggleAll}
          >
            {allChecked ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y" data-help-zone="item-parts-pick:liste">
          {isSplit && isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Chargement…</p>
          ) : rowCount === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {pageHint('item-parts-pick', isSplit ? 'emptySplit' : 'emptyAbsorb')}
            </p>
          ) : isSplit ? sections.map((s, i) => (
            <div key={i}>
              <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
                <input type="checkbox" className="mt-1" checked={h2.has(i)} onChange={() => setH2((prev) => toggleIn(prev, i))} />
                <span className="min-w-0">
                  <span className="block font-medium truncate">{s.title || 'Sans titre'}</span>
                  {textPreview(s.intro) && <span className="block text-xs text-muted-foreground line-clamp-2">{textPreview(s.intro)}</span>}
                </span>
              </label>
              {s.subsections.map((sub, j) => {
                const key = subKey(i, j);
                const disabled = !h2.has(i);
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 py-2 pr-3 pl-10 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={disabled}
                      checked={!disabled && h3.has(key)}
                      onChange={() => setH3((prev) => toggleIn(prev, key))}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm truncate">{sub.title || 'Sans titre'}</span>
                      {textPreview(sub.body) && <span className="block text-xs text-muted-foreground line-clamp-1">{textPreview(sub.body)}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )) : childItems.map((c) => (
            <label key={c.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" className="mt-1" checked={checked.has(c.id)} onChange={() => setChecked((prev) => toggleIn(prev, c.id))} />
              <span className="min-w-0">
                <span className="block font-medium truncate">{c.title || 'Sans titre'}</span>
                {textPreview(c.description) && <span className="block text-xs text-muted-foreground line-clamp-2">{textPreview(c.description)}</span>}
              </span>
            </label>
          ))}
        </div>

        {isSplit && contents.length > 0 && (
          <div className="space-y-2" data-help-zone="item-parts-pick:contenus">
            <p className="text-sm font-medium">Contenus</p>
            <p className="text-xs text-muted-foreground">{pageHint('item-parts-pick', 'contentsSplit')}</p>
            <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y">
              {contents.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2">
                  <span className="min-w-0 flex-1 text-sm truncate">
                    <span className="text-muted-foreground">{itemContentKindDef(c.kind)?.singular ?? c.kind} · </span>
                    {c.name || c.url || c.value || 'Sans nom'}
                  </span>
                  <select
                    className="text-sm border rounded-md px-2 py-1 bg-background max-w-[45%]"
                    value={effectiveTarget(c.id)}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  >
                    <option value="">Reste sur l'élément</option>
                    {destinations.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="bordered" onClick={onClose}>Annuler</Button>
          <HelpHint text={pageHint('item-parts-pick', isSplit ? 'confirmSplit' : 'confirmAbsorb')}>
            <Button
              onClick={isSplit ? confirmSplit : () => onConfirm(childItems.filter((c) => checked.has(c.id)).map((c) => c.id))}
              disabled={count === 0 || !!isPending}
            >
              {confirmLabel}
            </Button>
          </HelpHint>
        </div>
      </div>
    </Modal>
  );
}

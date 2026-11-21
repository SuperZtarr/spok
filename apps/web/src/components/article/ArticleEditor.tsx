/*
 * Mode « Composer » d'un article (fiche ItemEditModal, seulement si article.canEditArticle) :
 * - blocs réordonnables par glisser-déposer (@dnd-kit/sortable, poignée) → reorder optimiste (useArticle) ;
 * - barre de chaque bloc : « À côté » (sauf le 1er : à droite du bloc précédent, rangée de 3 colonnes max — largeur et
 *   position alors masquées), largeur (pleine / large / moyenne), position (centrée / gauche / droite, bloc « figure »
 *   seulement : élément qui ne porte que des images / schémas, blockLayout), « Ouvrir la fiche » si le lecteur a accès à l'élément, « Retirer » (l'élément n'est pas supprimé) ;
 * - texte modifiable sur place (RichTextEditor) : bloc d'un Élément (UNDEFINED, ex-Note fusionnée le 2026-11-11) si item.canEdit, enregistrée par itemsApi.update après une pause de
 *   frappe ; sinon lecture seule ;
 * - insertion entre deux blocs et en fin : « Élément » (ArticleBrowser : parcourir, cocher, ou prendre un processus)
 *   ou « Texte » (nouvel Élément de texte) ; un élément sans option = ajout unitaire ; plusieurs éléments, options enfants /
 *   chaîne, ou processus = ajout groupé : aperçu (articlesApi.previewBatch)
 *   → ArticleBatchConfirm → state.addBatch (confirmLessVisible = aperçu.lessVisible) ;
 * - 409 LESS_VISIBLE → ConfirmModal (texte de la fiche) puis renvoi avec confirmLessVisible ; 409 DUPLICATE_REFERENCE → message ;
 *   ajout groupé 403 SOURCE_UNREADABLE (élément ou processus illisible) → message batchForbidden de la fiche.
 * - panneau « À ajouter » à gauche (ElementTray, même modèle que le Process — demande Thomas 2026-11-21) : éléments de
 *   l'espace de l'article pas encore présents (articlesApi.browseItems, cache partagé avec ArticleBrowser), à glisser
 *   sur une barre d'insertion (ARTICLE_DRAG_TYPE, la barre visée s'éclaire) ou « + » = ajout en fin ; « Ajouter d'un
 *   autre espace » (ItemSearchPicker, ajout en fin) ; « Sélection multiple… » = ArticleBrowser en fin. Replié sur mobile.
 * Props : spaceId, articleId, article (ArticleView), state (retour de useArticle). Textes : pages/help/article.help.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Type, ExternalLink, Trash2, AlignCenter, AlignLeft, AlignRight, ListChecks } from 'lucide-react';
import type { ArticleBatchPreview, ArticleBatchSource, ArticleBlockAlign, ArticleBlockView, ArticleBlockWidth, ArticleView } from '@spok/shared';
import { ApiError, articlesApi, itemsApi } from '../../lib/api';
import type { useArticle } from '../../hooks/useArticle';
import { RichTextEditor } from '../ui/RichTextEditor';
import { ConfirmModal } from '../ConfirmModal';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';
import { blockLayout } from './articleBlockContent';
import { ArticleBlock } from './ArticleBlock';
import { ArticleBrowser } from './ArticleBrowser';
import { ArticleBatchConfirm } from './ArticleBatchConfirm';
import { moveBlock } from './articleLayout';
import { ElementTray, TrayElsewhereButton } from '../ElementTray';
import { ItemSearchPicker } from '../ItemSearchPicker';
import { Modal } from '../ui/Modal';

/** Type MIME du glisser depuis le panneau « À ajouter » vers une barre d'insertion (valeur = id de l'élément) */
export const ARTICLE_DRAG_TYPE = 'application/spok-article-item';

type ArticleState = ReturnType<typeof useArticle>;

const WIDTHS: { id: ArticleBlockWidth; label: string }[] = [
  { id: 'full', label: 'Pleine' }, { id: 'wide', label: 'Large' }, { id: 'medium', label: 'Moyenne' },
];
const ALIGNS: { id: ArticleBlockAlign; icon: typeof AlignCenter; label: string }[] = [
  { id: 'left', icon: AlignLeft, label: 'À gauche' }, { id: 'center', icon: AlignCenter, label: 'Centrée' }, { id: 'right', icon: AlignRight, label: 'À droite' },
];
const seg = (active: boolean) =>
  `px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`;

/** Note modifiable sur place : enregistre la description 800 ms après la dernière frappe. */
function NoteEditor({ spaceId, articleId, block }: { spaceId: string; articleId: string; block: ArticleBlockView }) {
  const item = block.item!;
  const queryClient = useQueryClient();
  const [html, setHtml] = useState(item.description ?? '');
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const onChange = (value: string) => {
    setHtml(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await itemsApi.update(item.spaceId!, item.id, { description: value });
        setFailed(false);
        queryClient.setQueryData<ArticleView>(['article', spaceId, articleId], (a) => a && ({
          ...a,
          blocks: a.blocks.map((b) => (b.id === block.id && b.item ? { ...b, item: { ...b.item, description: value } } : b)),
        }));
      } catch {
        setFailed(true);
      }
    }, 800);
  };
  return (
    <div>
      <RichTextEditor content={html} onChange={onChange} placeholder="Écrivez ici…" spaceId={item.spaceId ?? undefined} />
      {failed && <p className="mt-1 text-xs text-destructive">Modification non enregistrée — réessayez ou ouvrez la fiche.</p>}
    </div>
  );
}

function SortableBlock({ spaceId, articleId, block, state, isFirst }: { spaceId: string; articleId: string; block: ArticleBlockView; state: ArticleState; isFirst: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const item = block.item;
  const floatable = !!item && blockLayout(item) === 'figure';
  const editableNote = item?.type === 'UNDEFINED' && item.canEdit;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative rounded-md border border-dashed border-border px-2 pt-1 pb-2 my-3 bg-background">
      <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
        <button type="button" {...attributes} {...listeners} className="p-1 cursor-grab hover:text-foreground" aria-label="Déplacer le bloc">
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs truncate max-w-[40%]">{item ? item.title : '—'}</span>
        <span className="flex-1" />
        {!isFirst && (
          <HelpHint text={pageHint('article', 'beside')}>
            <button type="button" className={seg(block.beside)} aria-pressed={block.beside}
              onClick={() => state.updateBlock.mutate({ blockId: block.id, beside: !block.beside })}>
              À côté
            </button>
          </HelpHint>
        )}
        {item && !block.beside && (
          <HelpHint text={pageHint('article', 'width')}>
            <span className="inline-flex gap-0.5">
              {WIDTHS.map((w) => (
                <button key={w.id} type="button" className={seg(block.width === w.id)} onClick={() => state.updateBlock.mutate({ blockId: block.id, width: w.id })}>{w.label}</button>
              ))}
            </span>
          </HelpHint>
        )}
        {floatable && !block.beside && (
          <HelpHint text={pageHint('article', 'align')}>
            <span className="inline-flex gap-0.5">
              {ALIGNS.map((a) => (
                <button key={a.id} type="button" aria-label={a.label} className={seg(block.align === a.id)} onClick={() => state.updateBlock.mutate({ blockId: block.id, align: a.id })}>
                  <a.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </span>
          </HelpHint>
        )}
        {item?.canOpen && item.spaceId && (
          <HelpHint text={pageHint('article', 'openSource')}>
            <Link to={`/spaces/${item.spaceId}?item=${item.id}`} className="p-1 hover:text-foreground" aria-label="Ouvrir la fiche"><ExternalLink className="w-4 h-4" /></Link>
          </HelpHint>
        )}
        <HelpHint text={pageHint('article', 'remove')}>
          <button type="button" className="p-1 hover:text-destructive" aria-label="Retirer de l'article" onClick={() => state.removeBlock.mutate(block.id)}>
            <Trash2 className="w-4 h-4" />
          </button>
        </HelpHint>
      </div>
      <div className="flow-root">
        <ArticleBlock block={block}>
          {editableNote ? <NoteEditor spaceId={spaceId} articleId={articleId} block={block} /> : undefined}
        </ArticleBlock>
      </div>
      {item?.type === 'UNDEFINED' && !item.canEdit && <p className="text-xs text-muted-foreground">{pageHint('article', 'noteReadOnly')}</p>}
    </div>
  );
}

function InsertBar({ onItem, onText, onDropItem }: { onItem: () => void; onText: () => void; onDropItem: (itemId: string) => void }) {
  // Zone de dépôt d'un élément glissé depuis le panneau « À ajouter »
  const [over, setOver] = useState(false);
  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(ARTICLE_DRAG_TYPE);
  return (
    <div
      className={`flex items-center justify-center gap-2 py-1 rounded transition-opacity ${over ? 'opacity-100 bg-primary/10 ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}
      data-tour="article-insert"
      data-testid="article-insert"
      onDragOver={(e) => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!accepts(e)) return;
        e.preventDefault();
        const id = e.dataTransfer.getData(ARTICLE_DRAG_TYPE);
        if (id) onDropItem(id);
      }}
    >
      {over && <span className="text-xs text-primary">{pageHint('article', 'dropHere')}</span>}
      <HelpHint text={pageHint('article', 'addItem')}>
        <button type="button" onClick={onItem} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent">
          <Plus className="w-3.5 h-3.5" /> Élément
        </button>
      </HelpHint>
      <HelpHint text={pageHint('article', 'addText')}>
        <button type="button" onClick={onText} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent">
          <Type className="w-3.5 h-3.5" /> Texte
        </button>
      </HelpHint>
    </div>
  );
}

export function ArticleEditor({ spaceId, articleId, article, state }: { spaceId: string; articleId: string; article: ArticleView; state: ArticleState }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [pickAt, setPickAt] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ source: ArticleBatchSource; position: number; preview: ArticleBatchPreview | null } | null>(null);
  const [confirm, setConfirm] = useState<{ itemId: string; position: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ids = article.blocks.map((b) => b.id);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    state.reorder.mutate(moveBlock(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  const add = (itemId: string, position: number, confirmLessVisible = false) => {
    setMessage(null);
    state.addBlock.mutate({ itemId, position, confirmLessVisible }, {
      onSuccess: () => { setPickAt(null); setConfirm(null); },
      onError: (e) => {
        const code = e instanceof ApiError ? e.code ?? (e.details as { code?: string } | undefined)?.code : undefined;
        if (code === 'LESS_VISIBLE') { setPickAt(null); setConfirm({ itemId, position }); return; }
        setPickAt(null);
        setMessage(code === 'DUPLICATE_REFERENCE' ? pageHint('article', 'duplicate') ?? null : (e as Error).message);
      },
    });
  };

  // Ajout groupé : aperçu de l'API, puis confirmation (ArticleBatchConfirm) et insertion
  const batchError = (e: unknown) => {
    const code = e instanceof ApiError ? e.code ?? (e.details as { code?: string } | undefined)?.code : undefined;
    setBatch(null);
    setMessage(code === 'SOURCE_UNREADABLE' ? pageHint('article', 'batchForbidden') ?? null : (e as Error).message);
  };
  const startBatch = (source: ArticleBatchSource, position: number) => {
    setMessage(null);
    setPickAt(null);
    setBatch({ source, position, preview: null });
    articlesApi.previewBatch(spaceId, articleId, source).then(
      (preview) => setBatch((b) => (b && b.source === source ? { ...b, preview } : b)),
      batchError,
    );
  };
  const confirmBatch = () => {
    if (!batch?.preview) return;
    state.addBatch.mutate({ source: batch.source, position: batch.position, confirmLessVisible: batch.preview.lessVisible }, {
      onSuccess: () => setBatch(null),
      onError: batchError,
    });
  };
  // Sélecteur : un élément sans option = ajout unitaire ; sinon ajout groupé confirmé
  const pick = (itemIds: string[], w: { children: boolean; chain: boolean }) => {
    const position = pickAt ?? article.blocks.length;
    if (itemIds.length === 1 && !w.children && !w.chain) add(itemIds[0], position);
    else startBatch({ kind: 'items', itemIds, children: w.children, chain: w.chain }, position);
  };
  const presentIds = useMemo(
    () => new Set(article.blocks.map((b) => b.item?.id).filter((id): id is string => !!id)),
    [article.blocks],
  );
  const bar = (position: number) => (
    <InsertBar onItem={() => setPickAt(position)} onText={() => state.addText.mutate(position)} onDropItem={(id) => add(id, position)} />
  );

  // Panneau « À ajouter » : éléments de l'espace de l'article (même requête et cache que le sélecteur), hors présents
  const trayQuery = useQuery({
    queryKey: ['article-browse-items', spaceId, articleId, spaceId],
    queryFn: () => articlesApi.browseItems(spaceId, articleId, spaceId),
  });
  const trayItems = useMemo(() => (trayQuery.data?.items ?? []).filter((i) => !presentIds.has(i.id)), [trayQuery.data, presentIds]);
  const [elsewhereOpen, setElsewhereOpen] = useState(false);
  const atEnd = () => article.blocks.length;
  const [narrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches);

  return (
    <div className="flex items-start gap-3">
      <div className="sticky top-0 self-start flex max-h-[65vh]" data-tour="article-tray">
        <ElementTray
          items={trayItems}
          canEdit
          dragType={ARTICLE_DRAG_TYPE}
          labels={{ title: 'À ajouter', empty: pageHint('article', 'trayEmpty') ?? '', dragHint: pageHint('article', 'trayDrag') }}
          headerExtra={(<>
            <TrayElsewhereButton onClick={() => setElsewhereOpen(true)} hint={pageHint('article', 'trayElsewhere') ?? ''} />
            <HelpHint text={pageHint('article', 'trayMultiple')} className="block mt-1.5">
              <button type="button" onClick={() => setPickAt(atEnd())}
                className="w-full inline-flex items-center justify-center gap-1 h-7 rounded border border-dashed border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                <ListChecks className="w-3.5 h-3.5" /> Sélection multiple…
              </button>
            </HelpHint>
          </>)}
          rowAction={(i) => (
            <HelpHint text={pageHint('article', 'trayAdd')} className="inline-flex flex-shrink-0">
              <button type="button" onClick={() => add(i.id, atEnd())} aria-label={`Ajouter « ${i.title || 'Sans titre'} » à la fin`}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-background hover:text-foreground">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </HelpHint>
          )}
          defaultCollapsed={narrow}
          className="w-56 border border-border rounded-md"
        />
      </div>
      <div className="flex-1 min-w-0">
      {message && <p className="mb-2 text-sm text-destructive">{message}</p>}
      {bar(0)}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {article.blocks.map((b, i) => (
            <div key={b.id}>
              <SortableBlock spaceId={spaceId} articleId={articleId} block={b} state={state} isFirst={i === 0} />
              {bar(i + 1)}
            </div>
          ))}
        </SortableContext>
      </DndContext>
      </div>

      <Modal isOpen={elsewhereOpen} onClose={() => setElsewhereOpen(false)} title="Ajouter d'un autre espace" devName="ArticleEditor/AddElsewhere">
        <p className="text-xs text-muted-foreground mb-2">{pageHint('article', 'trayElsewhereIntro')}</p>
        <ItemSearchPicker
          spaceId={spaceId}
          defaultScope="community"
          doneIds={presentIds}
          actionLabel="Ajouter"
          autoFocus
          onPick={(hit) => { setElsewhereOpen(false); add(hit.id, atEnd()); }}
        />
      </Modal>

      <ArticleBrowser
        isOpen={pickAt !== null}
        onClose={() => setPickAt(null)}
        spaceId={spaceId}
        articleId={articleId}
        presentIds={presentIds}
        onAdd={pick}
        onAddProcess={(source) => startBatch(source, pickAt ?? article.blocks.length)}
      />
      <ArticleBatchConfirm
        isOpen={!!batch}
        preview={batch?.preview ?? null}
        isLoading={!!batch && !batch.preview}
        isPending={state.addBatch.isPending}
        onClose={() => setBatch(null)}
        onConfirm={confirmBatch}
      />
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && add(confirm.itemId, confirm.position, true)}
        title="Élément moins visible que l'article"
        message={pageHint('article', 'lessVisible') ?? ''}
        confirmLabel="Ajouter quand même"
        confirmVariant="default"
        isPending={state.addBlock.isPending}
      />
    </div>
  );
}

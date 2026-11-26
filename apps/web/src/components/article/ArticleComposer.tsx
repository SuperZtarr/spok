/*
 * Composition d'un article à la souris, sur la page Article (décision Thomas 2026-11-26 — remplace le mode Composer de
 * la fiche et ArticleEditor) : on compose dans le rendu de lecture (ArticleFlow), sans barre de réglages.
 * - Panneau « À ajouter » à gauche (ElementTray, même modèle que le Process) : éléments de l'espace de l'article pas
 *   encore présents, à glisser sur l'article ou « + » = à la fin ; « Ajouter d'un autre espace » (ItemSearchPicker),
 *   « Texte » (nouvel élément de texte, à la fin), « Sélection multiple… » (ArticleBrowser, ajout groupé à la fin).
 * - Glisser un bloc ou une ligne du panneau (HTML5) : sur le haut / bas d'un bloc = sa propre ligne au-dessus /
 *   au-dessous ; sur son bord gauche / droit = à côté (3 par ligne au plus) ; ailleurs = selon la hauteur. Un trait
 *   montre où il tombe (dropZone / applyDrop de articleLayout.ts). Un élément du panneau est ajouté à la fin puis placé.
 * - Largeur : poignée au bord droit d'un bloc seul (crans 1/3, 1/2, 2/3, 3/4, pleine — snapSingleWidth), ou trait
 *   entre deux blocs d'une ligne (partage — resizePair) ; pourcentage affiché pendant le geste, enregistré au lâcher.
 * - Au survol d'un bloc : poignée de déplacement, « Ouvrir la fiche » (si accès), « Retirer » (l'élément reste).
 * - Texte d'un élément modifiable sur place (NoteEditor, enregistré après une pause de frappe) ; on ne glisse pas
 *   depuis une zone de saisie.
 * Toute écriture de disposition passe par state.setLayout (PUT …/article/layout, disposition complète).
 * Erreurs : 409 LESS_VISIBLE → confirmation puis renvoi ; 409 DUPLICATE_REFERENCE, ligne pleine → message.
 * Props : spaceId, articleId, article (ArticleView), state (useArticle). Textes : pages/help/article.help.ts.
 * Composer au doigt (écran tactile) : non couvert — le glisser HTML5 vise la souris.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, GripVertical, ListChecks, Plus, Trash2, Type } from 'lucide-react';
import type { ArticleBatchPreview, ArticleBatchSource, ArticleBlockView, ArticleLayoutEntry, ArticleView } from '@spok/shared';
import { ARTICLE_ROW_MAX, ARTICLE_WIDTH_MAX, flattenRows, groupArticleRows } from '@spok/shared';
import { ApiError, articlesApi, itemsApi } from '../../lib/api';
import type { useArticle } from '../../hooks/useArticle';
import { RichTextEditor } from '../ui/RichTextEditor';
import { ConfirmModal } from '../ConfirmModal';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';
import { ArticleFlow, type BlockPlace } from './ArticleFlow';
import { ArticleBrowser } from './ArticleBrowser';
import { ArticleBatchConfirm } from './ArticleBatchConfirm';
import { applyDrop, dropZone, resizePair, snapSingleWidth, type DropTarget } from './articleLayout';
import { ElementTray, TrayElsewhereButton } from '../ElementTray';
import { ItemSearchPicker } from '../ItemSearchPicker';
import { Modal } from '../ui/Modal';

/** Type MIME du glisser depuis le panneau « À ajouter » (valeur = id de l'élément) */
export const ARTICLE_DRAG_TYPE = 'application/spok-article-item';
/** Type MIME du glisser d'un bloc de l'article (valeur = id du bloc) */
const BLOCK_DRAG_TYPE = 'application/spok-article-block';

type ArticleState = ReturnType<typeof useArticle>;
type Indicator = { x: number; y: number; w: number; h: number };
type Resize = { ids: string[]; widths: number[] };

const layoutOf = (blocks: ArticleBlockView[]): ArticleLayoutEntry[] =>
  blocks.map((b, i) => ({ id: b.id, beside: i > 0 && b.beside, width: b.width }));
const isTyping = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest('[contenteditable="true"], input, textarea, select');

/** Texte modifiable sur place : enregistre la description 800 ms après la dernière frappe. */
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

export function ArticleComposer({ spaceId, articleId, article, state }: { spaceId: string; articleId: string; article: ArticleView; state: ArticleState }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragBlock = useRef<string | null>(null);
  const target = useRef<DropTarget | null>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ itemId: string; target: DropTarget } | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [batch, setBatch] = useState<{ source: ArticleBatchSource; preview: ArticleBatchPreview | null } | null>(null);
  const [elsewhereOpen, setElsewhereOpen] = useState(false);
  const layout = useMemo(() => layoutOf(article.blocks), [article.blocks]);
  const atEnd = () => article.blocks.length;

  // Largeurs en cours de geste : appliquées au rendu, enregistrées au lâcher
  const shown = useMemo(() => {
    if (!resize) return article.blocks;
    return article.blocks.map((b) => {
      const i = resize.ids.indexOf(b.id);
      return i < 0 ? b : { ...b, width: resize.widths[i] };
    });
  }, [article.blocks, resize]);

  const presentIds = useMemo(() => new Set(article.blocks.map((b) => b.item?.id).filter((id): id is string => !!id)), [article.blocks]);
  const trayQuery = useQuery({
    queryKey: ['article-browse-items', spaceId, articleId, spaceId],
    queryFn: () => articlesApi.browseItems(spaceId, articleId, spaceId),
  });
  const trayItems = useMemo(() => (trayQuery.data?.items ?? []).filter((i) => !presentIds.has(i.id)), [trayQuery.data, presentIds]);
  const [narrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches);

  const errorCode = (e: unknown) => (e instanceof ApiError ? e.code ?? (e.details as { code?: string } | undefined)?.code : undefined);

  const place = (next: ArticleLayoutEntry[] | null, refused = false) => {
    if (next) state.setLayout.mutate(next, { onError: (e) => setMessage((e as Error).message) });
    else if (refused) setMessage(pageHint('article', 'rowFull') ?? null);
  };

  // Élément ajouté à la fin, puis placé à l'endroit visé
  const add = (itemId: string, where: DropTarget, confirmLessVisible = false) => {
    setMessage(null);
    const before = layout;
    state.addBlock.mutate({ itemId, position: before.length, confirmLessVisible }, {
      onSuccess: (view) => {
        setConfirm(null);
        if (where.kind === 'end') return;
        place(applyDrop([...before, { id: view.id, beside: false, width: ARTICLE_WIDTH_MAX }], view.id, where));
      },
      onError: (e) => {
        const code = errorCode(e);
        if (code === 'LESS_VISIBLE') { setConfirm({ itemId, target: where }); return; }
        setMessage(code === 'DUPLICATE_REFERENCE' ? pageHint('article', 'duplicate') ?? null : (e as Error).message);
      },
    });
  };

  // Ajout groupé (Sélection multiple…) : aperçu, confirmation, insertion à la fin
  const batchError = (e: unknown) => {
    setBatch(null);
    setMessage(errorCode(e) === 'SOURCE_UNREADABLE' ? pageHint('article', 'batchForbidden') ?? null : (e as Error).message);
  };
  const startBatch = (source: ArticleBatchSource) => {
    setMessage(null);
    setBrowserOpen(false);
    setBatch({ source, preview: null });
    articlesApi.previewBatch(spaceId, articleId, source).then(
      (preview) => setBatch((b) => (b && b.source === source ? { ...b, preview } : b)),
      batchError,
    );
  };
  const pick = (itemIds: string[], w: { children: boolean; chain: boolean }) => {
    if (itemIds.length === 1 && !w.children && !w.chain) { setBrowserOpen(false); add(itemIds[0], { kind: 'end' }); }
    else startBatch({ kind: 'items', itemIds, children: w.children, chain: w.chain });
  };
  const confirmBatch = () => {
    if (!batch?.preview) return;
    state.addBatch.mutate({ source: batch.source, position: atEnd(), confirmLessVisible: batch.preview.lessVisible }, {
      onSuccess: () => setBatch(null),
      onError: batchError,
    });
  };

  // ── Glisser-déposer : où tombe ce qu'on glisse, d'après le bloc ou la ligne sous le pointeur ──
  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(ARTICLE_DRAG_TYPE) || e.dataTransfer.types.includes(BLOCK_DRAG_TYPE);
  const locate = (e: React.DragEvent): { target: DropTarget; box: Indicator } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const c = canvas.getBoundingClientRect();
    const rel = (r: DOMRect, extra: Partial<Indicator>): Indicator => ({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: 3, ...extra });
    const blockEl = (e.target as Element).closest?.('[data-article-block]') as HTMLElement | null;
    if (blockEl && canvas.contains(blockEl)) {
      const id = blockEl.dataset.articleBlock!;
      const rowEl = blockEl.parentElement!;
      const rowIds = [...rowEl.querySelectorAll<HTMLElement>(':scope > [data-article-block]')].map((el) => el.dataset.articleBlock!);
      const canSide = rowIds.length < ARTICLE_ROW_MAX || (!!dragBlock.current && rowIds.includes(dragBlock.current));
      const r = blockEl.getBoundingClientRect();
      const zone = dropZone((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, canSide);
      if (zone === 'left' || zone === 'right') {
        return {
          target: { kind: 'side', refId: id, side: zone },
          box: { x: (zone === 'left' ? r.left - 8 : r.right + 5) - c.left, y: r.top - c.top, w: 3, h: r.height },
        };
      }
      const rr = rowEl.getBoundingClientRect();
      return {
        target: { kind: 'row', refId: id, pos: zone },
        box: rel(rr, { x: 0, w: c.width, y: (zone === 'before' ? rr.top - 8 : rr.bottom + 5) - c.top }),
      };
    }
    const rows = [...canvas.querySelectorAll<HTMLElement>('[data-article-row]')];
    if (rows.length === 0) return { target: { kind: 'end' }, box: { x: 0, y: 8, w: c.width, h: 3 } };
    let pick = rows[0];
    let after = false;
    for (const row of rows) if (e.clientY > row.getBoundingClientRect().top) { pick = row; after = true; }
    const ref = pick.querySelector<HTMLElement>('[data-article-block]')!.dataset.articleBlock!;
    const r = pick.getBoundingClientRect();
    return {
      target: { kind: 'row', refId: ref, pos: after ? 'after' : 'before' },
      box: { x: 0, w: c.width, h: 3, y: (after ? r.bottom + 5 : r.top - 8) - c.top },
    };
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragBlock.current ? 'move' : 'copy';
    const found = locate(e);
    target.current = found?.target ?? null;
    setIndicator(found?.box ?? null);
  };
  const endDrag = () => { dragBlock.current = null; target.current = null; setIndicator(null); };
  const onDrop = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    const where = target.current ?? locate(e)?.target ?? { kind: 'end' as const };
    const blockId = e.dataTransfer.getData(BLOCK_DRAG_TYPE);
    const itemId = e.dataTransfer.getData(ARTICLE_DRAG_TYPE);
    endDrag();
    setMessage(null);
    if (blockId) place(applyDrop(layout, blockId, where), where.kind === 'side');
    else if (itemId) add(itemId, where);
  };

  // ── Largeur : poignée au bord droit d'un bloc seul, ou trait entre deux blocs d'une ligne ──
  const startResize = (e: React.PointerEvent, block: ArticleBlockView, placeInRow: BlockPlace) => {
    e.preventDefault();
    e.stopPropagation();
    // Le bloc est glissable : sans cela, tirer la poignée lance le glisser du bloc et le geste ne reçoit plus la souris
    const draggableEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[draggable="true"]');
    if (draggableEl) draggableEl.draggable = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const blockEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-article-block]')!;
    const rowEl = blockEl.parentElement!;
    const rows = groupArticleRows(layout);
    const row = rows[placeInRow.row];
    let current: Resize | null = null;
    const compute = (clientX: number): Resize => {
      if (placeInRow.rowLength === 1) {
        const r = rowEl.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(rowEl).paddingLeft) || 0;
        const left = r.left + pad;
        const width = r.width - pad;
        // Bloc centré : son bord droit est à (50 + largeur / 2) % de la ligne
        const percent = 2 * (((clientX - left) / width) * 100 - 50);
        return { ids: [block.id], widths: [snapSingleWidth(percent)] };
      }
      const nextEl = blockEl.nextElementSibling as HTMLElement;
      const a = blockEl.getBoundingClientRect();
      const b = nextEl.getBoundingClientRect();
      const next = resizePair(row, placeInRow.col, (clientX - a.left) / (b.right - a.left));
      return { ids: next.map((x) => x.id), widths: next.map((x) => x.width) };
    };
    const move = (ev: PointerEvent) => { current = compute(ev.clientX); setResize(current); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (draggableEl) draggableEl.draggable = true;
      setResize(null);
      if (!current) return;
      const widths = new Map(current.ids.map((id, i) => [id, current!.widths[i]]));
      const next = flattenRows(rows).map((x) => (widths.has(x.id) ? { ...x, width: widths.get(x.id)! } : x));
      if (next.some((x, i) => x.width !== layout[i].width)) place(next);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const decorate = (block: ArticleBlockView, node: ReactNode, where: BlockPlace) => {
    const item = block.item;
    const resizing = resize?.ids.includes(block.id) ? resize.widths[resize.ids.indexOf(block.id)] : null;
    const handle = where.rowLength === 1 || where.col < where.rowLength - 1;
    return (
      <div
        draggable
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).draggable = !isTyping(e.target); }}
        onDragStart={(e) => {
          if (isTyping(e.target) || resize) { e.preventDefault(); return; }
          e.stopPropagation();
          dragBlock.current = block.id;
          e.dataTransfer.setData(BLOCK_DRAG_TYPE, block.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={endDrag}
        className="group/block relative h-full rounded-md border border-dashed border-border/60 hover:border-primary/60 px-2 py-1 cursor-grab active:cursor-grabbing"
      >
        <div className="absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-border bg-background px-0.5 shadow-sm opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition-opacity">
          <HelpHint text={pageHint('article', 'move')}>
            <span className="p-1 text-muted-foreground" aria-label="Glisser pour déplacer"><GripVertical className="w-4 h-4" /></span>
          </HelpHint>
          {item?.canOpen && item.spaceId && (
            <HelpHint text={pageHint('article', 'openSource')}>
              <Link to={`/spaces/${item.spaceId}?item=${item.id}`} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Ouvrir la fiche"><ExternalLink className="w-4 h-4" /></Link>
            </HelpHint>
          )}
          <HelpHint text={pageHint('article', 'remove')}>
            <button type="button" className="p-1 text-muted-foreground hover:text-destructive" aria-label="Retirer de l'article" onClick={() => state.removeBlock.mutate(block.id)}>
              <Trash2 className="w-4 h-4" />
            </button>
          </HelpHint>
        </div>
        {resizing !== null && (
          <span className="absolute top-1 left-2 z-10 rounded bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">{resizing} %</span>
        )}
        {node}
        {item?.type === 'UNDEFINED' && !item.canEdit && <p className="text-xs text-muted-foreground">{pageHint('article', 'noteReadOnly')}</p>}
        {handle && (
          <HelpHint text={pageHint('article', where.rowLength === 1 ? 'width' : 'share')} className="absolute top-2 bottom-2 -right-1.5 z-20 hidden sm:flex">
            <span
              role="separator"
              aria-orientation="vertical"
              aria-label="Tirer pour changer la largeur"
              onPointerDown={(e) => startResize(e, block, where)}
              draggable={false}
              className="group/handle flex w-3 justify-center cursor-col-resize touch-none"
            >
              <span className={`w-1.5 rounded-full ${resizing !== null ? 'bg-primary' : 'bg-muted-foreground/40 group-hover/handle:bg-primary'}`} />
            </span>
          </HelpHint>
        )}
      </div>
    );
  };

  const content = (block: ArticleBlockView) =>
    block.item?.type === 'UNDEFINED' && block.item.canEdit ? <NoteEditor spaceId={spaceId} articleId={articleId} block={block} /> : undefined;

  return (
    <div className="flex items-start gap-4">
      <div className="sticky top-0 self-start flex max-h-[75vh]" data-tour="article-tray" data-help-zone="article:panneau">
        <ElementTray
          items={trayItems}
          canEdit
          dragType={ARTICLE_DRAG_TYPE}
          labels={{ title: 'À ajouter', empty: pageHint('article', 'trayEmpty') ?? '', dragHint: pageHint('article', 'trayDrag') }}
          headerExtra={(<>
            <TrayElsewhereButton onClick={() => setElsewhereOpen(true)} hint={pageHint('article', 'trayElsewhere') ?? ''} />
            <HelpHint text={pageHint('article', 'addText')} className="block mt-1.5">
              <button type="button" onClick={() => state.addText.mutate(atEnd())}
                className="w-full inline-flex items-center justify-center gap-1 h-7 rounded border border-dashed border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                <Type className="w-3.5 h-3.5" /> Texte
              </button>
            </HelpHint>
            <HelpHint text={pageHint('article', 'trayMultiple')} className="block mt-1.5">
              <button type="button" onClick={() => setBrowserOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1 h-7 rounded border border-dashed border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                <ListChecks className="w-3.5 h-3.5" /> Sélection multiple…
              </button>
            </HelpHint>
          </>)}
          rowAction={(i) => (
            <HelpHint text={pageHint('article', 'trayAdd')} className="inline-flex flex-shrink-0">
              <button type="button" onClick={() => add(i.id, { kind: 'end' })} aria-label={`Ajouter « ${i.title || 'Sans titre'} » à la fin`}
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
        <div
          ref={canvasRef}
          className="relative min-h-[8rem] pb-8"
          data-tour="article-canvas"
          data-help-zone="article:composition"
          onDragOver={onDragOver}
          onDragLeave={(e) => { if (!canvasRef.current?.contains(e.relatedTarget as Node)) setIndicator(null); }}
          onDrop={onDrop}
        >
          {article.blocks.length === 0 && (
            <div className="rounded-md border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {pageHint('article', 'composeEmpty')}
            </div>
          )}
          <ArticleFlow blocks={shown} decorate={decorate} content={content} />
          {indicator && (
            <div className="pointer-events-none absolute z-20 rounded bg-primary"
              style={{ left: indicator.x, top: indicator.y, width: indicator.w, height: indicator.h }} />
          )}
        </div>
      </div>

      <Modal isOpen={elsewhereOpen} onClose={() => setElsewhereOpen(false)} title="Ajouter d'un autre espace" devName="ArticleComposer/AddElsewhere">
        <p className="text-xs text-muted-foreground mb-2">{pageHint('article', 'trayElsewhereIntro')}</p>
        <ItemSearchPicker
          spaceId={spaceId}
          defaultScope="community"
          doneIds={presentIds}
          actionLabel="Ajouter"
          autoFocus
          onPick={(hit) => { setElsewhereOpen(false); add(hit.id, { kind: 'end' }); }}
        />
      </Modal>

      <ArticleBrowser
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        spaceId={spaceId}
        articleId={articleId}
        presentIds={presentIds}
        onAdd={pick}
        onAddProcess={startBatch}
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
        onConfirm={() => confirm && add(confirm.itemId, confirm.target, true)}
        title="Élément moins visible que l'article"
        message={pageHint('article', 'lessVisible') ?? ''}
        confirmLabel="Ajouter quand même"
        confirmVariant="default"
        isPending={state.addBlock.isPending}
      />
    </div>
  );
}

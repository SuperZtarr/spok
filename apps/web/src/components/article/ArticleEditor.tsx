/*
 * Mode « Composer » d'un article (ArticlePage, seulement si article.canEditArticle) :
 * - blocs réordonnables par glisser-déposer (@dnd-kit/sortable, poignée) → reorder optimiste (useArticle) ;
 * - barre de chaque bloc : largeur (pleine / large / moyenne), position (centrée / gauche / droite, IMAGE et DIAGRAM
 *   seulement), « Ouvrir la fiche » si le lecteur a accès à l'élément, « Retirer » (l'élément n'est pas supprimé) ;
 * - note modifiable sur place (RichTextEditor) si item.canEdit, enregistrée par itemsApi.update après une pause de
 *   frappe ; sinon lecture seule ;
 * - insertion entre deux blocs et en fin : « Élément » (ArticleItemPicker) ou « Texte » (nouvelle note) ;
 * - 409 LESS_VISIBLE → ConfirmModal (texte de la fiche) puis renvoi avec confirmLessVisible ; 409 DUPLICATE_REFERENCE → message.
 * Props : spaceId, articleId, article (ArticleView), state (retour de useArticle). Textes : pages/help/article.help.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Type, ExternalLink, Trash2, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import type { ArticleBlockAlign, ArticleBlockView, ArticleBlockWidth, ArticleView } from '@spok/shared';
import { ApiError, itemsApi } from '../../lib/api';
import type { useArticle } from '../../hooks/useArticle';
import { RichTextEditor } from '../ui/RichTextEditor';
import { ConfirmModal } from '../ConfirmModal';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';
import { ArticleBlock } from './ArticleBlock';
import { ArticleItemPicker } from './ArticleItemPicker';
import { moveBlock } from './articleLayout';

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

function SortableBlock({ spaceId, articleId, block, state }: { spaceId: string; articleId: string; block: ArticleBlockView; state: ArticleState }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const item = block.item;
  const floatable = item?.type === 'IMAGE' || item?.type === 'DIAGRAM';
  const editableNote = item?.type === 'NOTE' && item.canEdit;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative rounded-md border border-dashed border-border px-2 pt-1 pb-2 my-3 bg-background">
      <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
        <button type="button" {...attributes} {...listeners} className="p-1 cursor-grab hover:text-foreground" aria-label="Déplacer le bloc">
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs truncate max-w-[40%]">{item ? item.title : '—'}</span>
        <span className="flex-1" />
        {item && (
          <HelpHint text={pageHint('article', 'width')}>
            <span className="inline-flex gap-0.5">
              {WIDTHS.map((w) => (
                <button key={w.id} type="button" className={seg(block.width === w.id)} onClick={() => state.updateBlock.mutate({ blockId: block.id, width: w.id })}>{w.label}</button>
              ))}
            </span>
          </HelpHint>
        )}
        {floatable && (
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
      {item?.type === 'NOTE' && !item.canEdit && <p className="text-xs text-muted-foreground">{pageHint('article', 'noteReadOnly')}</p>}
    </div>
  );
}

function InsertBar({ onItem, onText }: { onItem: () => void; onText: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 opacity-60 hover:opacity-100 transition-opacity">
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
  const [confirm, setConfirm] = useState<{ itemId: string; position: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ids = article.blocks.map((b) => b.id);
  const presentItemIds = new Set(article.blocks.map((b) => b.item?.id).filter((id): id is string => !!id));

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

  return (
    <div>
      {message && <p className="mb-2 text-sm text-destructive">{message}</p>}
      <InsertBar onItem={() => setPickAt(0)} onText={() => state.addText.mutate(0)} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {article.blocks.map((b, i) => (
            <div key={b.id}>
              <SortableBlock spaceId={spaceId} articleId={articleId} block={b} state={state} />
              <InsertBar onItem={() => setPickAt(i + 1)} onText={() => state.addText.mutate(i + 1)} />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <ArticleItemPicker isOpen={pickAt !== null} onClose={() => setPickAt(null)} excludeIds={presentItemIds} onPick={(itemId) => add(itemId, pickAt ?? article.blocks.length)} />
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

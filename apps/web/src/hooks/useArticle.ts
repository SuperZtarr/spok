/*
 * useArticle(spaceId, articleId) — état d'un article (type ARTICLE) : ArticleView sous queryKey ['article', spaceId, articleId].
 * Écritures : addBlock(itemId, { position, confirmLessVisible }) — rejette l'ApiError 409 LESS_VISIBLE à l'appelant, qui
 * demande confirmation puis rappelle avec confirmLessVisible ; addBatch({ source, position, confirmLessVisible }) insère
 * une grappe ou un processus (aperçu préalable par articlesApi.previewBatch) ; addText(position) crée une note dans l'espace de l'article ;
 * setLayout(entries) : disposition complète (ordre, lignes, largeurs — utils/articleLayout.ts de @spok/shared), optimiste
 * (cache restauré en cas d'échec) ; removeBlock(blockId) retire la référence (l'élément n'est jamais supprimé, sa ligne
 * se resserre côté API). Réservé à ArticlePage, ArticleReadBlocks et ArticleComposer.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArticleBatchSource, ArticleLayoutEntry, ArticleView } from '@spok/shared';
import { articlesApi } from '../lib/api';

/** Blocs du cache remis dans l'ordre et la disposition demandés (les blocs absents de entries sont gardés à la fin) */
export function withLayout(view: ArticleView, entries: ArticleLayoutEntry[]): ArticleView {
  const byId = new Map(view.blocks.map((b) => [b.id, b]));
  const placed = entries.filter((e) => byId.has(e.id)).map((e, position) => ({ ...byId.get(e.id)!, position, beside: position > 0 && e.beside, width: e.width }));
  const rest = view.blocks.filter((b) => !entries.some((e) => e.id === b.id));
  return { ...view, blocks: [...placed, ...rest] };
}

export function useArticle(spaceId: string | undefined, articleId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['article', spaceId, articleId];
  const query = useQuery({
    queryKey,
    queryFn: () => articlesApi.get(spaceId!, articleId!),
    enabled: !!spaceId && !!articleId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const patchCache = (fn: (v: ArticleView) => ArticleView) => {
    const prev = queryClient.getQueryData<ArticleView>(queryKey);
    if (prev) queryClient.setQueryData<ArticleView>(queryKey, fn(prev));
    return prev;
  };

  const addBlock = useMutation({
    mutationFn: (v: { itemId: string; position?: number; confirmLessVisible?: boolean }) => articlesApi.addBlock(spaceId!, articleId!, v),
    onSuccess: refresh,
  });

  const addBatch = useMutation({
    mutationFn: (v: { source: ArticleBatchSource; position?: number; confirmLessVisible?: boolean }) => articlesApi.addBatch(spaceId!, articleId!, v),
    onSuccess: refresh,
  });

  const addText = useMutation({
    mutationFn: (position?: number) => articlesApi.addText(spaceId!, articleId!, position),
    onSuccess: refresh,
  });

  const setLayout = useMutation({
    mutationFn: (entries: ArticleLayoutEntry[]) => articlesApi.setLayout(spaceId!, articleId!, entries),
    onMutate: (entries) => ({ prev: patchCache((a) => withLayout(a, entries)) }),
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
    onSettled: refresh,
  });

  const removeBlock = useMutation({
    mutationFn: (blockId: string) => articlesApi.removeBlock(spaceId!, articleId!, blockId),
    onSuccess: refresh,
  });

  return { ...query, article: query.data, refresh, addBlock, addBatch, addText, setLayout, removeBlock };
}

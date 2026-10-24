/*
 * useArticle(spaceId, articleId) — état d'un article (type ARTICLE) : ArticleView sous queryKey ['article', spaceId, articleId].
 * Écritures : addBlock(itemId, { position, confirmLessVisible }) — rejette l'ApiError 409 LESS_VISIBLE à l'appelant, qui
 * demande confirmation puis rappelle avec confirmLessVisible ; addBatch({ source, position, confirmLessVisible }) insère
 * une grappe ou un processus (aperçu préalable par articlesApi.previewBatch) ; addText(position) crée une note dans l'espace de l'article ;
 * updateBlock(blockId, { width, align }) et reorder(blockIds) optimistes (cache restauré en cas d'échec) ;
 * removeBlock(blockId) retire la référence (l'élément n'est jamais supprimé). Réservé à ArticlePage / ArticleEditor.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArticleBatchSource, ArticleBlockAlign, ArticleBlockWidth, ArticleView } from '@spok/shared';
import { articlesApi } from '../lib/api';

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

  const updateBlock = useMutation({
    mutationFn: (v: { blockId: string; width?: ArticleBlockWidth; align?: ArticleBlockAlign }) =>
      articlesApi.updateBlock(spaceId!, articleId!, v.blockId, { width: v.width, align: v.align }),
    onMutate: (v) => ({
      prev: patchCache((a) => ({
        ...a,
        blocks: a.blocks.map((b) => (b.id === v.blockId ? { ...b, ...(v.width && { width: v.width }), ...(v.align && { align: v.align }) } : b)),
      })),
    }),
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: (blockIds: string[]) => articlesApi.reorder(spaceId!, articleId!, blockIds),
    onMutate: (blockIds) => ({
      prev: patchCache((a) => ({
        ...a,
        blocks: blockIds.map((id, position) => ({ ...a.blocks.find((b) => b.id === id)!, position })),
      })),
    }),
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
    onSettled: refresh,
  });

  const removeBlock = useMutation({
    mutationFn: (blockId: string) => articlesApi.removeBlock(spaceId!, articleId!, blockId),
    onSuccess: refresh,
  });

  return { ...query, article: query.data, refresh, addBlock, addBatch, addText, updateBlock, reorder, removeBlock };
}

/*
 * useQuestion(spaceId, itemId) — état d'une question (type QUESTION) : QuestionView sous queryKey
 * ['question', spaceId, itemId] (options, décompte nominatif, issue, droits du lecteur).
 * Écritures : vote(optionIds) (remplace mon vote ; refusé par l'API si la question n'est plus ouverte),
 * setOutcome({ status, chosenOptionId?, answerText?, note? }) (issue — change le statut de l'élément),
 * saveOptions({ multiple?, options }) (liste complète, id gardé pour une option corrigée).
 * Après une issue ou des options, la fiche ['item', …] et les listes ['items', spaceId] sont relues : le statut et
 * updatedAt ont changé (sinon faux conflit 409 à l'enregistrement de la fiche).
 * En séance, l'événement SSE { type: 'question' } relit la question (useLiveSession → invalidateQuestion).
 * Réservé à QuestionPanel et LiveQuestionControls.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { QuestionOptionsInput, QuestionOutcomeInput, QuestionView } from '@spok/shared';
import { questionsApi } from '../lib/api';

/** Relit une question où qu'elle soit affichée (événement de séance : l'espace n'est pas connu). */
export function invalidateQuestion(queryClient: QueryClient, itemId: string) {
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'question' && q.queryKey[2] === itemId });
}

export function useQuestion(spaceId: string | undefined, itemId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ['question', spaceId, itemId];
  const query = useQuery({
    queryKey,
    queryFn: () => questionsApi.get(spaceId!, itemId!),
    enabled: enabled && !!spaceId && !!itemId,
  });

  const store = (view: QuestionView) => queryClient.setQueryData(queryKey, view);
  const refreshItem = () => {
    queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
  };

  const vote = useMutation({
    mutationFn: (optionIds: string[]) => questionsApi.vote(spaceId!, itemId!, optionIds),
    onSuccess: store,
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setOutcome = useMutation({
    mutationFn: (body: QuestionOutcomeInput) => questionsApi.setOutcome(spaceId!, itemId!, body),
    onSuccess: (view) => { store(view); refreshItem(); },
  });

  const saveOptions = useMutation({
    mutationFn: (body: QuestionOptionsInput) => questionsApi.saveOptions(spaceId!, itemId!, body),
    onSuccess: (view) => { store(view); refreshItem(); },
  });

  return { question: query.data, isLoading: query.isLoading, error: query.error, vote, setOutcome, saveOptions };
}

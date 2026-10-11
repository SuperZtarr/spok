/*
 * Actions « Séance » sur un item (menu contextuel via itemMenuGroups, pied de ItemEditModal) :
 * « Ajouter à la préparation » (séance active préparée ou en direct) et « Présenter en séance » (en direct),
 * seulement pour l'animateur/les présentateurs de la séance active (useActiveLiveSessionStore).
 * « Ajouter à la préparation » passe par requestAddToAgenda : si l'élément a des sous-éléments directs, la question
 * « avec les sous-éléments ? » est posée (pendingAdd → AddChildrenDialog), sinon ajout direct.
 * L'espace source est résolu côté API (l'accès de l'utilisateur y est vérifié). Le résultat est posé dans le
 * cache ['live-session', spaceId] (préparation) ; l'affichage arrive par le flux. Pas de système de toast dans
 * l'app : les erreurs sont signalées par window.alert. Les libellés nomment la séance visée (séance active).
 * Vocabulaire : « préparation » partout (anciennement « programme », renommé le 2026-10-11, décision Thomas) ;
 * seul l'identifiant technique `agenda` (routes, champs, types) est conservé.
 */
import { ListPlus, Presentation } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import type { ItemAction } from '../components/ui/ItemActionMenu';
import { useActiveLiveSessionStore, type ActiveLiveInfo } from '../stores/activeLiveSession';
import { liveSessionsApi } from './api';
import { queryClient } from './queryClient';

const report = (e: unknown) => window.alert(e instanceof Error ? e.message : 'Action impossible');

/** Ajoute à la préparation et pose la liste renvoyée dans le cache de la séance. */
export async function addToAgenda(info: ActiveLiveInfo, liveSpaceId: string | null, itemId: string, includeChildren: boolean) {
  const agenda = await liveSessionsApi.addToAgenda(info.sessionId, itemId, undefined, includeChildren);
  queryClient.setQueryData<LiveSessionState>(['live-session', liveSpaceId], (prev) => (prev ? { ...prev, agenda } : prev));
}

/** « Ajouter à la préparation » : question sur les sous-éléments s'il y en a, sinon ajout direct. */
export async function requestAddToAgenda(itemId: string, info: ActiveLiveInfo, liveSpaceId: string | null) {
  const { count } = await liveSessionsApi.sourceChildren(info.sessionId, itemId);
  if (count > 0) useActiveLiveSessionStore.getState().setPendingAdd({ itemId, count });
  else await addToAgenda(info, liveSpaceId, itemId, false);
}

export function buildLiveItemActions(itemId: string, info: ActiveLiveInfo | null, liveSpaceId: string | null): ItemAction[] {
  if (!info || info.myRole === 'PARTICIPANT' || info.status === 'ENDED') return [];
  const actions: ItemAction[] = [{
    id: 'live-add-agenda',
    label: `Ajouter à la préparation de ${info.spaceName}`,
    icon: ListPlus,
    onClick: () => { requestAddToAgenda(itemId, info, liveSpaceId).catch(report); },
  }];
  if (info.status === 'LIVE') {
    actions.push({
      id: 'live-present',
      label: `Présenter dans ${info.spaceName}`,
      icon: Presentation,
      onClick: () => { liveSessionsApi.display(info.sessionId, { sourceItemId: itemId }).catch(report); },
    });
  }
  return actions;
}

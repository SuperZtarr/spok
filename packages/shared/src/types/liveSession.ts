/*
 * Types des séances de présentation en direct (étape 1 « Socle » + étape 2 « Préparation » : statut PREPARED,
 * programme LiveAgendaItem, révélation progressive des sous-items — current.children = sous-items révélés ;
 * « suite » d'une séance terminée : previousSession / nextSession).
 * LiveEvent = messages SSE de GET /live-sessions/:id/stream — le client les applique sur LiveSessionState.
 * Ne pas y mettre de données d'espaces sources : un participant ne reçoit que des copies de l'espace de séance.
 */
import type { Item } from './item.js';

export type LiveSessionStatus = 'PREPARED' | 'LIVE' | 'ENDED';
export type LiveSessionRoleType = 'HOST' | 'PRESENTER';
export type LiveSessionEntryKind = 'DISPLAY' | 'JOIN';

export interface LiveUser { id: string; name: string; avatarUrl?: string | null }

export interface LiveSessionEntry {
  id: string;
  kind: LiveSessionEntryKind;
  createdAt: string;
  user: LiveUser;
  itemId: string | null;
  itemTitle: string | null;
}

export interface LiveSession {
  id: string;
  spaceId: string;
  parentSpaceId: string;
  hostId: string;
  status: LiveSessionStatus;
  controllerId: string | null;
  currentEntryId: string | null;
  startedAt: string;
  liveAt: string | null;
  endedAt: string | null;
  /** Séance précédente (cette séance en est la suite) et séance suivante, si elles existent. */
  previousSession: LiveSessionLink | null;
  nextSession: LiveSessionLink | null;
}

export interface LiveSessionLink { id: string; spaceId: string; spaceName: string }

/** Ligne du programme : lien vers un item source (pas de copie avant l'affichage). */
export interface LiveAgendaItem {
  id: string;
  presenter: LiveUser;
  sourceItemId: string;
  sourceSpaceId: string;
  sourceSpaceName: string | null;
  title: string;
  position: number;
  presentedAt: string | null;
}

/** Item affiché dans la fenêtre en direct : la copie + ses sous-items déjà révélés. */
export interface LiveDisplayedItem { item: Item; children: Item[] }

export interface LiveSessionState {
  session: LiveSession;
  spaceName: string;
  roles: Array<{ userId: string; role: LiveSessionRoleType; user: LiveUser }>;
  myRole: LiveSessionRoleType | 'PARTICIPANT';
  entries: LiveSessionEntry[];          // chronologique ascendant
  agenda: LiveAgendaItem[];             // ordonné par position
  current: (LiveDisplayedItem & { entry: LiveSessionEntry }) | null;
  presence: LiveUser[];
}

export type LiveEvent =
  | { type: 'display'; entry: LiveSessionEntry; displayed: LiveDisplayedItem }
  | { type: 'join'; entry: LiveSessionEntry }
  | { type: 'presence'; presence: LiveUser[] }
  | { type: 'roles'; roles: LiveSessionState['roles'] }
  | { type: 'ended'; endedAt: string }
  | { type: 'started'; liveAt: string }
  | { type: 'agenda'; agenda: LiveAgendaItem[] }
  | { type: 'reveal'; parentItemId: string; child: Item };

/** Sous-item de l'élément courant pas encore révélé (vu seulement par l'animateur/les présentateurs). */
export interface LivePendingChild { sourceItemId: string; title: string }

/** Résumé d'une séance pour la liste de l'espace parent. */
export interface LiveSessionSummary {
  id: string;
  spaceId: string;
  spaceName: string;
  status: LiveSessionStatus;
  startedAt: string;
  isMember: boolean;
}

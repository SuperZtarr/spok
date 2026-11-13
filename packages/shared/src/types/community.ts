/* Types communauté : Community, memberships, rôles, visibilité, admin.
 * Visibilité : `visibility` / `pendingVisibility` uniquement (isPublic/pendingPublic supprimés le 2026-10-16). */
export type CommunityRole = 'OWNER' | 'MEMBER';

export type CommunityVisibility = 'OPEN' | 'READONLY' | 'PRIVATE';

/** Contexte d'usage d'une communauté — dicte le mode d'interface dérivé (null = neutre « tous »).
 *  JDR : affiché « Loisirs » dans l'interface, nom historique conservé en base et dans l'API. */
export type CommunityContext = 'FORUM' | 'PROJECT' | 'JDR' | 'DOCUMENTATION' | 'EXPLORATION';

/** Valeurs du contexte, dans l'ordre des choix (validation API, paramètres de la communauté). DOCUMENTATION et
 *  EXPLORATION ajoutés le 2026-11-13. */
export const COMMUNITY_CONTEXTS = ['FORUM', 'PROJECT', 'JDR', 'DOCUMENTATION', 'EXPLORATION'] as const satisfies readonly CommunityContext[];

export interface Community {
  id: string;
  name: string;
  description?: string;
  context?: CommunityContext | null;
  /** Source de vérité de la visibilité (renvoyée par l'API). */
  visibility?: CommunityVisibility;
  /** Visibilité demandée, en attente de validation admin (null = pas de demande). */
  pendingVisibility?: CommunityVisibility | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverPosition?: number;
  coverZoom?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityWithRole extends Community {
  role: CommunityRole | 'VIEWER' | 'INVITED' | 'ADMIN_VIEW' | null;
  order?: number;
  memberCount?: number;
  spaceCount?: number;
  muted?: boolean;
}

export interface CommunityMembership {
  id: string;
  userId: string;
  communityId: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface CommunityMember {
  id: string;
  userId: string;
  /** Présent seulement pour le propriétaire de la communauté ou l'admin en mode admin (règle members-email-scope) */
  email?: string;
  name: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface CreateCommunityInput {
  name: string;
  description?: string;
  visibility?: CommunityVisibility;
  context?: CommunityContext | null;
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  visibility?: CommunityVisibility;
  context?: CommunityContext | null;
}

export interface InviteCommunityMemberInput {
  email: string;
  role: CommunityRole;
}

// Admin types
export interface AdminCommunity {
  id: string;
  name: string;
  description?: string;
  visibility: CommunityVisibility;
  pendingVisibility: CommunityVisibility | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverPosition?: number;
  coverZoom?: number;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  spaceCount: number;
}

export interface AdminCommunityMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface AdminCommunitySpace {
  id: string;
  name: string;
  type: string;
  memberCount: number;
}

export interface AdminCommunityDetail extends AdminCommunity {
  members: AdminCommunityMember[];
  spaces: AdminCommunitySpace[];
}

export interface CommunityEmailSummary {
  id: string;
  subject: string;
  sentAt: string;
  sentBy: { id: string; name: string; email: string };
  recipientCount: number;
}

export interface CommunityEmailDetail extends CommunityEmailSummary {
  html: string;
  recipients: { userId: string; name: string; email: string; sentAt: string }[];
}

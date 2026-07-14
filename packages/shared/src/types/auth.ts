/* Types auth : AuthUser, credentials, réponses de tokens, admin. */
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type GlobalRole = 'USER' | 'ADMIN';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  globalRole: GlobalRole;
  themePreference: ThemePreference;
  avatarUrl?: string;
  lastLoginAt?: string; // ISO — date de la connexion précédente (avant la mise à jour courante)
}

export interface UpdatePreferencesInput {
  themePreference?: ThemePreference;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

// Admin types
export interface AdminUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
  globalRole: GlobalRole;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    memberships: number;
    communityMemberships: number;
    createdItems: number;
    contributions: number;
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  globalRole?: GlobalRole;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  globalRole?: GlobalRole;
}

export interface AdminUserCommunityMembership {
  id: string;
  role: string;
  joinedAt: string;
  community: {
    id: string;
    name: string;
  };
}

export interface AdminUserSpaceMembership {
  id: string;
  role: string;
  joinedAt: string;
  space: {
    id: string;
    name: string;
    type: string;
  };
}

export interface AdminUserDetail extends AdminUser {
  communityMemberships: AdminUserCommunityMembership[];
  memberships: AdminUserSpaceMembership[];
}

/** Rôle effectif d'un utilisateur sur un nœud de l'arbre d'accès (admin/users/:id/access-tree). */
export type AccessRole = 'OWNER' | 'MEMBER' | 'VIEWER' | 'ADMIN' | null;
/** D'où vient l'accès : membership directe, héritée de la communauté, communauté publique, bypass admin global, ou aucun. */
export type AccessSource = 'direct' | 'community' | 'public' | 'admin' | null;

export interface AccessTreeNode {
  id: string;
  name: string;
  kind: 'community' | 'space';
  role: AccessRole;
  source: AccessSource;
  children: AccessTreeNode[];
}

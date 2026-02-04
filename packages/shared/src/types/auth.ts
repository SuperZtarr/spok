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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
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
  name: string;
  globalRole: GlobalRole;
  createdAt: string;
  updatedAt: string;
  _count?: {
    memberships: number;
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

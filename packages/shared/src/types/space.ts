/* Types espace : Space, memberships, rôles, visibilité, préférences. */
export type SpaceType = 'PERSONAL' | 'GROUP';
export type Role = 'OWNER' | 'MEMBER' | 'VIEWER';
export type SpaceVisibility = 'OPEN' | 'READONLY' | 'PRIVATE';

export interface Space {
  id: string;
  name: string;
  description?: string | null;
  type: SpaceType;
  communityId?: string | null;
  community?: { id: string; name: string; avatarUrl?: string | null } | null;
  parentId?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverPosition?: number;
  coverZoom?: number;
  defaultRole?: Role | null;
  visibility?: SpaceVisibility;
  defaultView?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceMembership {
  id: string;
  userId: string;
  spaceId: string;
  role: Role;
  joinedAt: string;
}

export interface SpaceWithRole extends Space {
  role: Role;
  memberCount?: number;
  itemCount?: number;
  isMember?: boolean;
  parent?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
  type: SpaceType;
  communityId?: string;
  parentId?: string;
  templateId?: string;
}

export interface UpdateSpaceInput {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  defaultRole?: Role | null;
  visibility?: SpaceVisibility;
}

export interface InviteMemberInput {
  email: string;
  role: Role;
}

export interface SpaceMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  joinedAt: string;
}

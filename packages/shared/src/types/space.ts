export type SpaceType = 'PERSONAL' | 'GROUP';
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  communityId?: string;
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
}

export interface CreateSpaceInput {
  name: string;
  type: SpaceType;
  communityId?: string;
}

export interface UpdateSpaceInput {
  name?: string;
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

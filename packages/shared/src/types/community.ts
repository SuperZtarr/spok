export type CommunityRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Community {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityWithRole extends Community {
  role: CommunityRole;
  memberCount?: number;
  spaceCount?: number;
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
  email: string;
  name: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface CreateCommunityInput {
  name: string;
  description?: string;
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
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

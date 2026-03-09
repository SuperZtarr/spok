import type { Role } from './space.js';
import type { CommunityRole } from './community.js';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface Invitation {
  id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  role: string; // Role or CommunityRole
  message?: string | null;
  communityId?: string | null;
  spaceId?: string | null;
  invitedById: string;
  invitedBy?: { id: string; name: string; email: string };
  community?: { id: string; name: string } | null;
  space?: { id: string; name: string } | null;
  expiresAt: string;
  respondedAt?: string | null;
  createdAt: string;
}

export interface CreateInvitationInput {
  email: string;
  role: Role | CommunityRole;
  message?: string;
}

export interface InvitationWithDetails extends Invitation {
  invitedBy: { id: string; name: string; email: string };
}

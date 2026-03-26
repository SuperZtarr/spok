export interface Reaction {
  id: string;
  reactionType: string;
  userId: string;
  itemId?: string | null;
  contributionId?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  };
}

export interface ReactionSummary {
  type: string;
  count: number;
  userReacted: boolean; // whether the current user has this reaction
}

// Default reaction types — extensible
export const DEFAULT_REACTION_TYPES = [
  { id: 'contribution', label: 'Contribution', emoji: '💬' },
  { id: 'pertinent', label: 'Pertinent', emoji: '✅' },
  { id: 'inexact', label: 'Inexact', emoji: '⚠️' },
  { id: 'inadapte', label: 'Inadapté', emoji: '🚫' },
  { id: 'j_adore', label: "J'adore", emoji: '❤️' },
  { id: 'trollage', label: 'Trollage', emoji: '🤡' },
] as const;

export type DefaultReactionType = typeof DEFAULT_REACTION_TYPES[number]['id'];

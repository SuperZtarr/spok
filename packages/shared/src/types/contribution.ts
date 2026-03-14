export interface Contribution {
  id: string;
  content: string;
  itemId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionWithAuthor extends Contribution {
  author: {
    id: string;
    name: string;
    email: string;
  };
  reactionSummary?: import('./reaction.js').ReactionSummary[];
}

export interface CreateContributionInput {
  content: string;
}

export interface UpdateContributionInput {
  content: string;
}

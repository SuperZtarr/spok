/* Types contribution : Contribution, avec auteur et réactions. */
export interface Contribution {
  id: string;
  content: string;
  itemId: string;
  authorId: string;
  parentId?: string | null;
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
  children?: ContributionWithAuthor[];
}

export interface CreateContributionInput {
  content: string;
  parentId?: string;
}

export interface UpdateContributionInput {
  content: string;
}

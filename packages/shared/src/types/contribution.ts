/* Types contribution : Contribution, avec auteur et réactions.
 * reactionType : vote de l'auteur au moment d'écrire (id de DEFAULT_REACTION_TYPES), figé à la création — règle
 * contribution-vote-kept ; absent/null pour les anciennes contributions. Non modifiable par UpdateContributionInput. */
export interface Contribution {
  id: string;
  content: string;
  itemId: string;
  authorId: string;
  parentId?: string | null;
  reactionType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionWithAuthor extends Contribution {
  author: {
    id: string;
    name: string;
  };
  reactionSummary?: import('./reaction.js').ReactionSummary[];
  children?: ContributionWithAuthor[];
}

export interface CreateContributionInput {
  content: string;
  parentId?: string;
  reactionType?: string;
}

export interface UpdateContributionInput {
  content: string;
}

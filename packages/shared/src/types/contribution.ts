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
}

export interface CreateContributionInput {
  content: string;
}

export interface UpdateContributionInput {
  content: string;
}
